/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const inquirer = require('inquirer');
const spawn = require('child_process').spawnSync;
const fs = require('fs-extra');
const path = require('path');
const ncp = require('ncp').ncp; // We use ncp because https://npmjs.com/pkg is not compatible with fs-extra's copyFile functions. https://github.com/zeit/pkg/issues/420

const displayCommand = require('../../lib/displayCommand');
const { getConfig, saveConfig } = require('../../lib/parseConfig');
const { success, warn, failure, header, questionPrefix, varFmt, clc } = require('../../lib/colorScheme');

let customizationFile = 'app.json';

/**
 * Feature Overview: https://cloud.google.com/cloud-build/
 * Feature Documentation: https://cloud.google.com/cloud-build/docs/
 * Feature Documentation: https://cloud.google.com/cloud-build/docs/build-config
 * @param {object} options - Initialized from commander.js.
 */
const cloudbuild = async (options) => {
    return new Promise(async (resolve, reject) => {
        console.log(header('\n=== Cloud Build Setup\n'));

        await propogateCloudBuildConfig(options.name, options.region, options.platform, options.cluster, options.clusterzone);
        setupCloudbuildIAM(options.platform, options.dryrun, options.verbose); // We use cloudbuild to run the deployment regardless of using a commit or not.

        // Check if customization specifies cloudbuild, if so then set it (but only check if it's not specified as an argument)
        if (options.build == undefined) {
            try {
                if (JSON.parse(fs.readFileSync(customizationFile)).cloudbuild) options.build = 'commit';
            } catch (e) {}
        }

        if (options.build) {
            if (options.build == 'commit') {
                await enableTriggers(options.name, options.dryrun, options.verbose).catch((e) => {
                    console.log(failure('Fatal error. Recommend cleaning up with `crbt destroy`. Exiting...'));
                    process.exit(1);
                });
                return resolve();
            } else if (options.build == 'none') {
                console.log(success('Skipping trigger setup...\n'));
                return resolve();
            } else {
                console.log(failure('Build trigger type not recognized. Prompting for more details...'));
            }
        }

        // Ask if they want automatic triggers
        console.log('\n' + warn('Cloud Build triggers can be used to automatically start container builds and service deployment upon code commit to Cloud Source Repository. Without an automatic trigger, the service can still be deployed with `' + clc.yellow('crbt deploy') + '` to manually initiate Cloud Build.'));
        inquirer
            .prompt([
                {
                    type: 'list',
                    name: 'cloudbuild',
                    prefix: questionPrefix,
                    message: 'Do you want to setup a trigger with Cloud Build to automatically build and deploy the Cloud Run services on commit to Cloud Source Repository?',
                    choices: ['Yes', 'No'],
                },
            ])
            .then(async (answers) => {
                // It doesn't make sense to have a trigger for one service but not the others, so enable for all.
                if (answers.cloudbuild == 'Yes') {
                    options.build = 'commit';
                    await enableTriggers(options.name, options.dryrun, options.verbose).catch((e) => {
                        console.log(failure('Fatal error. Recommend cleaning up with `crbt destroy`. Exiting...'));
                    });
                    return resolve();
                } else if (answers.cloudbuild == 'No') {
                    options.build = 'none';
                    console.log(success('Skipping trigger setup...\n'));
                    return resolve();
                }
            });
    });
};

/**
 * Copy in a template cloudbuild.yaml file that will be used to instruct Cloud Build on what to do.
 * @param {string} name - Service name.
 * @param {string} region - Region (specific to managed platform)
 * @param {string} platform - Platform (managed or gke).
 * @param {string} clusterName - GKE Cluster name (specific to gke platform)
 * @param {string} clusterZone - GKE Cluster zone (specific to gke platform)
 */
async function propogateCloudBuildConfig(name, region, platform, clusterName, clusterZone) {
    return new Promise(async (resolve, reject) => {
        // Rename any existing cloudbuild.yaml file so it doesn't get destroyed/overwritten.
        if (fs.existsSync('cloudbuild.yaml')) {
            const date_ob = new Date(Date.now());
            let postfix = date_ob.getFullYear() + '-' + date_ob.getMonth() + 1 + '-' + date_ob.getDate() + '-' + date_ob.getHours() + date_ob.getMinutes();
            fs.renameSync('cloudbuild.yaml', 'cloudbuild.yaml-old-' + postfix);
        }

        if (platform === 'managed') {
            // Allow unauthenticated by default.
            let allowUnauthenticated = true;
            try {
                allowUnauthenticated = JSON.parse(fs.readFileSync(customizationFile)).options['allow-unauthenticated'];
            } catch (e) {}
            if (typeof allowUnauthenticated !== 'boolean') allowUnauthenticated = true;

            await saveConfig('options', 'allow-unauthenticated', allowUnauthenticated);
            await copyTemplate(name, './', allowUnauthenticated, region);
        } else if (platform === 'gke') {
            await copyGKETemplate(name, './', clusterName, clusterZone);
        }

        return resolve();
    });
}

/**
 * Template copy of cloudbuild.yaml specific to platform set to managed.
 * @param {string} serviceName - Service name.
 * @param {string} destination - Where to copy the file.
 * @param {boolean} allowUnauthenticated - Whether or not to allow unauthenticated access to service.
 * @param {string} region - Region for service.
 */
async function copyTemplate(serviceName, destination, allowUnauthenticated, region) {
    return new Promise((resolve, reject) => {
        ncp(path.resolve(__dirname, '../../templates/cloudbuild/cloudbuild.yaml'), destination + 'cloudbuild.yaml', function (err) {
            // Copy in template
            if (err) {
                console.error('Error copying template: ' + err);
                return reject();
            } else {
                console.log(success('Copied template (' + varFmt('cloudbuild.yaml') + ') into `' + varFmt(destination) + '`.'));
                fs.readFile(destination + 'cloudbuild.yaml', 'utf8', function (err, data) {
                    // Update template
                    if (err) {
                        return reject();
                    }
                    let result = data.replace(/namePlaceholder/g, serviceName);
                    result = result.replace(/pathPlaceholder/g, destination);
                    result = result.replace(/regionPlaceholder/g, region);

                    if (allowUnauthenticated) result = result.replace(/authPlaceholder/g, '--allow-unauthenticated');
                    else result = result.replace(/authPlaceholder/g, '--no-allow-unauthenticated');

                    fs.writeFile(destination + 'cloudbuild.yaml', result, 'utf8', function (err) {
                        if (err) return reject();
                        console.log(success('Updated ' + varFmt('cloudbuild.yaml') + ' within `' + varFmt(destination) + '`.'));
                        return resolve();
                    });
                });
            }
        });
    });
}

/**
 * Template copy of cloudbuild.yaml specific to platform set to gke.
 * @param {string} serviceName - Service name.
 * @param {string} destination - Where to copy the file.
 * @param {string} clusterName - GKE Cluster Name.
 * @param {string} clusterZone - GKE Cluster Zone.
 */
async function copyGKETemplate(serviceName, destination, clusterName, clusterZone) {
    return new Promise((resolve, reject) => {
        ncp(path.resolve(__dirname, '../../templates/cloudbuild/cloudbuild-gke.yaml'), destination + 'cloudbuild.yaml', function (err) {
            // Copy in template
            if (err) {
                console.error('Error copying template: ' + err);
                return reject();
            } else {
                console.log(success('Copied template (' + varFmt('cloudbuild.yaml') + ') into `' + varFmt(destination) + '`.'));
                fs.readFile(destination + 'cloudbuild.yaml', 'utf8', function (err, data) {
                    // Update template
                    if (err) {
                        return reject();
                    }
                    let result = data.replace(/namePlaceholder/g, serviceName);
                    result = result.replace(/pathPlaceholder/g, destination);
                    result = result.replace(/clusterPlaceholder/g, clusterName);
                    result = result.replace(/clusterZonePlaceholder/g, clusterZone);
                    //if (allowUnauthenticated) result = result.replace(/authPlaceholder/g, '--allow-unauthenticated');
                    //else result = result.replace(/authPlaceholder/g, '--no-allow-unauthenticated');

                    fs.writeFile(destination + 'cloudbuild.yaml', result, 'utf8', function (err) {
                        if (err) return reject();
                        console.log(success('Updated ' + varFmt('cloudbuild.yaml') + ' within `' + varFmt(destination) + '`.'));
                        return resolve();
                    });
                });
            }
        });
    });
}

/**
 * Create Cloud Build trigger based on commits to the master branch of the Cloud Source Repositories repository.
 * @param {string} name - Service name.
 * @param {boolean} dryrun - Perform the actions or simply do a dry tun test and display what would be done.
 * @param {boolean} verbose - Verbosity level.
 */
async function enableTriggers(name, dryrun, verbose) {
    return new Promise(async (resolve, reject) => {
        let repoName = getConfig('repo', 'name');

        // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/beta/builds/triggers/create/
        let command = ['beta', 'builds', 'triggers', 'create', 'cloud-source-repositories', '--repo', repoName, '--branch-pattern', '^master$', '--build-config=cloudbuild.yaml'];

        if (dryrun) {
            displayCommand('gcloud', command);
            await saveConfig('cloudbuild', name + '-trigger', '');
            console.log();
            return resolve();
        }

        let trigger = '';
        const triggerCreate = spawn('gcloud', command);
        if (verbose) {
            if (triggerCreate.stdout.toString('utf8') !== '') console.log(triggerCreate.stdout.toString('utf8'));
            if (triggerCreate.stderr.toString('utf8') !== '') console.log(triggerCreate.stderr.toString('utf8'));
        }
        if (triggerCreate.status === 0) {
            console.log(success('Cloud Build trigger created.'));

            trigger = triggerCreate.stderr.toString('utf8').split('/');
            trigger = trigger[trigger.length - 1].split(']')[0];
            await saveConfig('cloudbuild', name + '-trigger', trigger);
        } else {
            console.log(failure('Cloud Build trigger creation Failed.'));
            return reject();
        }

        console.log();
        return resolve();
    });
}

/**
 * Grant Cloud Build's service account sufficient IAM permissions to perform the steps necessary within the cloudbuild.yaml steps (roles/run.admin & roles/iam.serviceAccountUser)
 * @param {boolean} dryrun - Perform the actions or simply do a dry tun test and display what would be done.
 * @param {boolean} verbose - Verbosity level.
 */
function setupCloudbuildIAM(platform, dryrun, verbose) {
    let projectId = getConfig('project', 'id');

    let runAdminCommand = ['projects', 'add-iam-policy-binding', projectId, '--member=serviceAccount:' + projectId + '@cloudbuild.gserviceaccount.com', '--role=roles/run.admin'];
    let serviceAccountUserIAMCommand = ['projects', 'add-iam-policy-binding', projectId, '--member=serviceAccount:' + projectId + '@cloudbuild.gserviceaccount.com', '--role=roles/iam.serviceAccountUser'];
    let gkeDevelCommand = ['projects', 'add-iam-policy-binding', projectId, '--member=serviceAccount:' + projectId + '@cloudbuild.gserviceaccount.com', '--role=roles/container.developer'];

    if (dryrun) {
        displayCommand('gcloud', runAdminCommand);
        displayCommand('gcloud', serviceAccountUserIAMCommand);
        if (platform === 'gke') displayCommand('gcloud', gkeDevelCommand);
        return;
    }

    let runAdminIAM = spawn('gcloud', runAdminCommand);
    if (verbose) {
        if (runAdminIAM.stdout.toString('utf8') !== '') console.log(runAdminIAM.stdout.toString('utf8'));
        if (runAdminIAM.stderr.toString('utf8') !== '') console.log(runAdminIAM.stderr.toString('utf8'));
    }
    if (runAdminIAM.status === 0) {
        console.log(success('Cloud Build IAM Policy added (' + varFmt(projectId + '@cloudbuild.gserviceaccount.com') + '): ' + varFmt('roles/run.admin')));
    } else {
        console.log(failure('Cloud Build IAM Policy Creation Failed:' + varFmt('roles/run.admin')));
    }

    let serviceAccountUserIAM = spawn('gcloud', serviceAccountUserIAMCommand);
    if (verbose) {
        if (serviceAccountUserIAM.stdout.toString('utf8') !== '') console.log(serviceAccountUserIAM.stdout.toString('utf8'));
        if (serviceAccountUserIAM.stderr.toString('utf8') !== '') console.log(serviceAccountUserIAM.stderr.toString('utf8'));
    }
    if (serviceAccountUserIAM.status === 0) {
        console.log(success('Cloud Build IAM Policy added (' + varFmt(projectId + '@cloudbuild.gserviceaccount.com') + '): ' + varFmt('roles/iam.serviceAccountUser')));
    } else {
        console.log(failure('Cloud Build IAM Policy Creation Failed: ' + varFmt('roles/iam.serviceAccountUser')));
    }

    if (platform === 'gke') {
        let gkeDevelIAM = spawn('gcloud', gkeDevelCommand);
        if (verbose) {
            if (gkeDevelIAM.stdout.toString('utf8') !== '') console.log(gkeDevelIAM.stdout.toString('utf8'));
            if (gkeDevelIAM.stderr.toString('utf8') !== '') console.log(gkeDevelIAM.stderr.toString('utf8'));
        }
        if (gkeDevelIAM.status === 0) {
            console.log(success('Cloud Build IAM Policy added (' + varFmt(projectId + '@cloudbuild.gserviceaccount.com') + '): ' + varFmt('roles/run.admin')));
        } else {
            console.log(failure('Cloud Build IAM Policy Creation Failed:' + varFmt('roles/run.admin')));
        }
    }
}

module.exports = cloudbuild;
