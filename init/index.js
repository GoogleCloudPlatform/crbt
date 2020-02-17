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
const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');
const spawn = require('child_process').spawnSync;

const csr = require('./csr/index');
const git = require('./git/index');
const cloudbuild = require('./cloudbuild/index');
const domain = require('./domain/index');
const findServices = require('../lib/findServices');
const customize = require('../customize/index');
const { populateTemplateList } = require('../list/index');
const enableAPI = require('../lib/enableAPI');

const { success, warn, failure, header, highlight, questionPrefix, varFmt, clc } = require('../lib/colorScheme');
const { saveConfig } = require('../lib/parseConfig');
const { checkInstalled, checkGcloudProject, checkLocalDir, checkGitLocalAuth, checkGitConfig } = require('../lib/checkPrereqs');
let customizationFile = 'app.json';

/**
 * Entry point to handle initialization of what to create. Definition of what to create can be done interactively or non-interactively (through cli arguments).
 * @param {object} options - Initialized from commander.js.
 */
const initialize = async function(options) {
    if (!options.dryrun) {
        // Perform pre-requisite checks.
        checkInstalled(['git', 'gcloud']); // Check for needed programs.
        checkGcloudProject(); // Check if gcloud is initialized sufficiently.
        checkGitLocalAuth(); // Check for git authentication configuration.
        checkGitConfig(); // Check for git configuration of name and email.
    }

    let customName;
    try {
        customName = JSON.parse(fs.readFileSync(customizationFile)).name;
    } catch (e) {}
    // Sanitize options.name because commander.js passes options.name as a function if it's not defined. Services also want it in lowercase.
    // Priority: --name, customization file name value, directory name
    if (typeof options.name !== 'function') options.name = options.name.toLowerCase();
    // Container Registry and some other services requires name to be lowercase.
    else if (customName) options.name = customName.toLowerCase();
    else options.name = path.basename(path.resolve()).toLowerCase();

    const TEMPLATE_ROOT = path.resolve(__dirname, '../templates/');
    const BANNER_TEXT = fs.readFileSync(path.join(TEMPLATE_ROOT, 'banner.txt'), 'utf8');

    console.log(header(BANNER_TEXT));

    if (options.dryrun) {
        console.log('\nThis is a ' + clc.yellow('dry run') + ', and no commands will actually execute. Otherwise, this would initialize within this directory: \n\n' + highlight(process.cwd()));
    } else {
        console.log('\nYou’re about to initialize a crbt project (' + varFmt(options.name) + ') inside this directory: \n\n' + highlight(process.cwd()));
    }

    console.log(header('\n=== Project Setup\n'));

    if (!options.dryrun) {
        if (!options.existing && !options.sourcerepo) {
            await checkLocalDir('./').catch((e) => {
                if (options.local === undefined) {
                    // Only allow files in the initialization directory if using '--local' as the base.
                    console.log(failure('Directory must be empty to initialize. If meant to deploy local code, use ' + clc.yellow('--local') + '. To override, use ' + clc.yellow('--existing') + '. Exiting...'));
                    process.exit(1);
                } else {
                    // Or if --use-config
                    if (fs.existsSync('.crbt')) {
                        console.log(failure('An existing .crbt configuration file found. Please make sure this is not a duplicate initialization. Exiting...'));
                        console.log(warn('If meant to restore from previous deployment, rename ' + varFmt('.crbt') + ' to ' + varFmt('app.json') + '.'));
                        process.exit(1);
                    }
                }
            }); // Check if local directory is empty if not using local source.
        }
    }

    // Enable required GCP Service APIs.
    enableAPI('sourcerepo', options.dryrun, options.verbose);
    enableAPI('cloudbuild', options.dryrun, options.verbose);
    enableAPI('run', options.dryrun, options.verbose);

    await saveConfig('name', options.name); // Could put this below, but it's visually more appealing to have this first in the config.

    await determinePlatform(options); // Find out which Cloud Run region to utilize.

    let projectName = spawn('gcloud', ['config', 'get-value', 'project'])
        .stdout.toString('utf8')
        .trim(); // Do this after csr or csr will fail due to directory not being empty.
    await saveConfig('project', 'name', projectName);
    let projectIdList = spawn('gcloud', ['projects', 'list'])
        .stdout.toString('utf8')
        .split('\n');
    for (let projectLine in projectIdList) {
        if (projectIdList[projectLine].includes(projectName)) {
            let projectId = projectIdList[projectLine].split(' ');
            projectId = projectId[projectId.length - 1];
            await saveConfig('project', 'id', projectId);
        }
    }
    await saveConfig('repo', 'name', options.name).catch((e) => {});
    console.log();

    await determineBase(options);
    await deploy(options);

    if (options.build !== 'none') {
        if (!options.dryrun) {
            await findServices(options).catch((e) => {
                console.log('Error finding service URL. Something likely went wrong in the build process. Review Cloud Build logs.');
                process.exit(1);
            });
        }

        await customize(options).catch((e) => {});

        let domainMapped = await domain(options); // Create domain mapping if flagged.
        if (domainMapped && !options.dryrun) console.log(success(header('Domain-mapped URL: ') + clc.greenBright.underline('https://' + options.map)));

        if (!options.dryrun) console.log(highlight('\ncrbt initialization complete!'));
        else console.log(highlight('\ncrbt dry run complete!'));
    } else {
        console.log(highlight('\ncrbt initialization complete!\n'));
        console.log(warn('Since automated builds were not enabled, to perform deployment execute: ' + header('crbt deploy')));
        if (options.map) console.log(warn('Domain mapping is not supported without automatic builds, since the service must first be deployed.'));
    }
};

/**
 * Determine whether the user wants to deploy to Fully Managed Cloud Run (managed) or Cloud Run on Anthos on Google Cloud (gke).
 * @param {object} options - Initialized from commander.js.
 */
function determinePlatform(options) {
    return new Promise(async (resolve, reject) => {
        if (options.platform === undefined) {
            // Check if customization specifies platform, if so then set it.
            try {
                options.platform = JSON.parse(fs.readFileSync(customizationFile)).platform;
            } catch (e) {}
        }

        if (options.platform === 'managed') {
            await saveConfig('platform', options.platform);
            await determineRegion(options);
            return resolve();
        } else if (options.platform === 'gke') {
            await saveConfig('platform', options.platform);
            await determineGKECluster(options);
            await determineGKEZoneLocation(options);
            return resolve();
        } else {
            inquirer
                .prompt([
                    {
                        type: 'list',
                        name: 'platform',
                        prefix: questionPrefix,
                        message: 'Would you like to deploy to Cloud Run (managed) or Cloud Run on Anthos on Google Cloud (gke)?',
                        choices: ['managed', 'gke']
                    }
                ])
                .then(async function(answers) {
                    if (answers.platform === 'managed') {
                        options.platform = 'managed';
                        await saveConfig('platform', options.platform);
                        await determineRegion(options);
                        return resolve();
                    } else if (answers.platform === 'gke') {
                        options.platform = 'gke';
                        await saveConfig('platform', options.platform);
                        await determineGKECluster(options);
                        await determineGKEZoneLocation(options);
                        return resolve();
                    }
                });
        }
    });
}

/**
 * Determine the GKE cluster name if using gke as the platform.
 * @param {object} options - Initialized from commander.js.
 */
function determineGKECluster(options) {
    return new Promise(async (resolve, reject) => {
        if (options.cluster == undefined) {
            // Check if customization specifies cluster, if so then set it.
            try {
                options.cluster = JSON.parse(fs.readFileSync(customizationFile)).cluster;
            } catch (e) {}
        }

        if (options.cluster === undefined) {
            inquirer
                .prompt([
                    {
                        type: 'input',
                        name: 'cluster',
                        prefix: questionPrefix,
                        message: 'What is the name of the GKE Cluster to use?'
                    }
                ])
                .then(async function(answers) {
                    console.log(); // For spacing layout purposes.
                    options.cluster = answers.cluster;
                    await saveConfig('cluster', options.cluster);
                    return resolve();
                });
        } else {
            await saveConfig('cluster', options.cluster);
            return resolve();
        }
    });
}

/**
 * Determine the GKE cluster zone if using gke as the platform.
 * @param {object} options - Initialized from commander.js.
 */
function determineGKEZoneLocation(options) {
    return new Promise(async (resolve, reject) => {
        if (options.clusterzone == undefined) {
            // Check if customization specifies cluster, if so then set it.
            try {
                options.clusterzone = JSON.parse(fs.readFileSync(customizationFile)).clusterzone;
            } catch (e) {}
        }

        if (options.clusterzone === undefined) {
            inquirer
                .prompt([
                    {
                        type: 'input',
                        name: 'clusterzone',
                        prefix: questionPrefix,
                        message: 'What GCP zone does the GKE cluster reside within?'
                    }
                ])
                .then(async function(answers) {
                    console.log(); // For spacing layout purposes.
                    options.clusterzone = answers.clusterzone;
                    await saveConfig('clusterzone', options.clusterzone);
                    return resolve();
                });
        } else {
            await saveConfig('clusterzone', options.clusterzone);
            return resolve();
        }
    });
}

/**
 * Determine what base for source the user would like:
 *  - template: Sample code built in to crbt
 *  - local: Source already in the current directory
 *  - git: An external git repository
 * @param {object} options - Initialized from commander.js.
 */
function determineBase(options) {
    return new Promise(async (resolve, reject) => {
        if ((options.sourcerepo !== undefined && options.template !== undefined) || (options.sourcerepo !== undefined && options.local !== undefined) || (options.local !== undefined && options.template !== undefined)) {
            console.log(failure('The commands ' + varFmt('--sourcerepo') + ', ' + varFmt('--template') + ', and ' + varFmt('--local') + ' are mutually exclusive. Exiting...'));
            process.exit(1);
        }

        if (options.sourcerepo !== undefined) {
            await determineSourceRepo(options);
            return resolve();
        } else if (options.template !== undefined) {
            await determineTemplate(options);
            return resolve();
        } else if (options.local !== undefined) {
            return resolve();
        } else {
            inquirer
                .prompt([
                    {
                        type: 'list',
                        name: 'base',
                        prefix: questionPrefix,
                        message: 'Would you like to use a built-in template, local source within current directory, or clone an external Git repository?',
                        choices: ['template', 'local', 'git']
                    }
                ])
                .then(async function(answers) {
                    if (answers.base === 'template') await determineTemplate(options);
                    else if (answers.base === 'git') await determineSourceRepo(options);
                    else if (answers.base === 'local') options.local = '.';
                    return resolve();
                });
        }
    });
}

/**
 * Determine which GCP region to use.
 * Cloud Run (fully managed) locations: https://cloud.google.com/run/docs/locations
 * @param {object} options - Initialized from commander.js.
 */
function determineRegion(options) {
    return new Promise(async (resolve, reject) => {
        const GCP_REGIONS = ['asia-northeast1', 'europe-west1', 'us-central1', 'us-east1'];
        if (options.region == undefined) {
            // Check if customization specifies cloudbuild, if so then set it.
            try {
                //if ((JSON.parse(fs.readFileSync(customizationFile))).region)
                options.region = JSON.parse(fs.readFileSync(customizationFile)).region;
            } catch (e) {}
        }

        if (options.region == undefined) {
            inquirer
                .prompt([
                    {
                        type: 'list',
                        name: 'region',
                        prefix: questionPrefix,
                        message: 'Which region would you like to utilize?',
                        choices: GCP_REGIONS
                    }
                ])
                .then(async function(answers) {
                    console.log(); // For spacing layout purposes.
                    options.region = answers.region;
                    await saveConfig('region', options.region);
                    return resolve();
                });
        } else {
            if (!GCP_REGIONS.includes(options.region)) {
                console.log(failure('Invalid region selected. Exiting...'));
                process.exit(1);
            }
            await saveConfig('region', options.region);
            return resolve();
        }
    });
}

/**
 * Determine the URL of the source repository to clone if user chose git as base.
 * @param {object} options - Initialized from commander.js.
 */
function determineSourceRepo(options) {
    return new Promise(async (resolve, reject) => {
        if (options.sourcerepo == undefined) {
            inquirer
                .prompt([
                    {
                        type: 'input',
                        name: 'repo',
                        prefix: questionPrefix,
                        message: 'What source repository would you like to use?'
                    }
                ])
                .then(async function(answers) {
                    options.sourcerepo = answers.repo;
                    if (!options.sourcerepo.includes('.git')) {
                        console.log(failure('Invalid source repository URL (' + varFmt(options.sourcerepo) + ') provided. Ensure the entire .git link is entered.'));
                        process.exit(1);
                    }
                    console.log(success('Source repository selected: ' + varFmt(options.sourcerepo) + '\n'));
                    return resolve();
                });
        } else {
            if (!options.sourcerepo.includes('.git')) {
                console.log(failure('Invalid source repository URL (' + varFmt(options.sourcerepo) + ') provided. Ensure the entire .git link is entered.'));
                process.exit(1);
            } else {
                console.log(success('Source repository selected: ' + varFmt(options.sourcerepo) + '\n'));
                return resolve();
            }
        }
    });
}

/**
 * Determine which template to use if user chose template as base.
 * @param {object} options - Initialized from commander.js.
 */
function determineTemplate(options) {
    return new Promise(async (resolve, reject) => {
        const TEMPLATE_ROOT = path.resolve(__dirname, '../templates/');
        const templateList = await populateTemplateList(TEMPLATE_ROOT + '/cloudrun/');

        if (options.template == undefined) {
            inquirer
                .prompt([
                    {
                        type: 'list',
                        name: 'template',
                        prefix: questionPrefix,
                        message: 'What template would you like to use?',
                        choices: templateList
                    }
                ])
                .then(async function(answers) {
                    options.template = answers.template;
                    console.log(success('Template selected: ' + varFmt(options.template) + '\n'));
                    return resolve();
                });
        } else {
            if (!templateList.includes(options.template)) {
                console.log(failure('Invalid template (' + varFmt(options.template) + ') selected. To see available templates run: crbt list'));
                process.exit(1);
            } else {
                console.log(success('Template selected: ' + varFmt(options.template) + '\n'));
                return resolve();
            }
        }
    });
}

/**
 * Perform the deployment steps. This function calls all child functions of each feature.
 * @param {object} options - Initialized from commander.js.
 */
async function deploy(options) {
    return new Promise(async (resolve, reject) => {
        await csr(options);

        if (options.platform === 'gke') checkGkeUnauthViolation();

        await cloudbuild(options);
        git(options);
        return resolve();
    });
}

/**
 * If service is configured to not allow unauthenticated access, then don't allow it to be deployed to GKE which doesn't support that method through crbt.
 */
function checkGkeUnauthViolation() {
    let allowUnauthenticated = true;
    try {
        allowUnauthenticated = JSON.parse(fs.readFileSync(customizationFile)).options['allow-unauthenticated'];
    } catch (e) {}
    if (typeof allowUnauthenticated !== 'boolean') allowUnauthenticated = true;
    if (!allowUnauthenticated) {
        console.log();
        console.log(failure('Attempting to use GKE with an app.json that forbids unauthenticated access. Authentication (' + varFmt('--[no-]allow-unauthenticated') + ') is not a valid flag for Cloud Run with GKE. Exiting to avoid exposing a service without unauthentication improperly...'));
        process.exit(1);
    }
}

module.exports = initialize;
