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

const spawn = require('child_process').spawnSync;
const fs = require('fs-extra');

const { removeConfigSection, getConfig } = require('../../lib/parseConfig');
const { success, warn, failure, header, varFmt, clc } = require('../../lib/colorScheme');

/**
 * Handle destruction of services within Cloud Run, as well as images within Container Registry.
 * Feature Overview: https://cloud.google.com/run/ && https://cloud.google.com/container-registry/
 * Feature Documentation: https://cloud.google.com/run/docs/ && https://cloud.google.com/container-registry/docs/
 * @param {object} options - Initialized from commander.js.
 */
const cloudrun = async (options) => {
    return new Promise(async (resolve, reject) => {
        console.log(header('=== Cloud Run Destroy\n'));
        let services = null;
        try {
            services = await getConfig('cloudrun');
        } catch (e) {
            console.log(failure('Unable to read cloudrun name from config.'));
            console.log(warn('Recommended to check if Cloud Run services still exists with: ' + clc.yellow('gcloud beta run services list --platform managed')));
            console.log(warn('If need to delete manually, delete with: ' + clc.yellow('gcloud beta run services delete [NAME} --platform managed --region [REGION]')));
            return resolve();
        }
        if (services !== undefined) {
            let platform = await getConfig('platform');
            let cluster = null;
            let clusterzone = null;
            try {
                cluster = await getConfig('cluster');
                clusterzone = await getConfig('clusterzone');
            } catch (e) {}

            let region = null;
            try {
                region = await getConfig('region');
            } catch (e) {}

            for (let serviceName in services) {
                try {
                    let destroySvcResult = destroyService(serviceName, platform, cluster, clusterzone, region, options.verbose);
                    if (!options.preserve && destroySvcResult) {
                        await removeConfigSection('cloudrun').catch((e) => {});
                        await removeConfigSection('platform').catch((e) => {});
                        if (cluster) {
                            await removeConfigSection('cluster').catch((e) => {});
                            await removeConfigSection('clusterzone').catch((e) => {});
                        }
                    }
                } catch (e) {
                    let region = getConfig('region');
                    console.log(warn('Some services did not delete completely.'));
                    console.log(warn('Recommended to check if services still exists with: ' + clc.yellow('gcloud beta run services list')));
                    console.log(warn('If need to delete manually, delete with: ' + clc.yellow('gcloud beta run services delete [NAME] --platform managed --region ' + region)));
                }
                await destroyImage(serviceName, options.verbose).catch((e) => {});
                console.log();
            }
        } else {
            console.log(warn('No Cloud Run services found in config file.'));
            console.log(warn('Trying to auto-detect service name in current directory. Failure to delete may be due to service having never been deployed.'));
            // Get the service name by parsing the cloudbuild.yaml file.
            let serviceName = null;
            let region = null;
            let cloudbuildyaml = null;

            try {
                cloudbuildyaml = fs
                    .readFileSync('cloudbuild.yaml')
                    .toString()
                    .split('\n');
            } catch (e) {
                console.log(warn('No Cloud Build file found in current directory. Skipping Cloud Run service removal...'));
                return resolve();
            }

            for (let line in cloudbuildyaml) {
                if (cloudbuildyaml[line].includes("run', 'deploy")) {
                    // This is an example line:
                    //     args: ['alpha', 'run', 'deploy', 'test7', '--image', 'gcr.io/$PROJECT_ID/test7', '--platform', 'managed', '--allow-unauthenticated', '--region=us-east1']

                    if (cloudbuildyaml[line].includes('platform=gke')) {
                        platform = 'gke';
                        let splitline = cloudbuildyaml[line]
                            .split('[')[1]
                            .toString()
                            .split(' ');

                        let serviceName = splitline[3].split("'")[1];
                        let cluster = splitline[7].split('=')[1].split("'")[0];
                        let clusterzone = splitline[8].split('=')[1].split("'")[0];
                        destroyService(serviceName, platform, cluster, clusterzone, null, options.verbose);
                        await destroyImage(serviceName, options.verbose).catch((e) => {});
                    }
                    if (cloudbuildyaml[line].includes('platform=managed')) {
                        platform = 'managed';
                        let splitline = cloudbuildyaml[line]
                            .split('[')[1]
                            .toString()
                            .split(' ');

                        let serviceName = splitline[3].split("'")[1];
                        let region = splitline[8].split('=')[1].split("'")[0];
                        destroyService(serviceName, platform, null, null, region, options.verbose);
                        await destroyImage(serviceName, options.verbose).catch((e) => {});
                    }
                }
            }
        }
        return resolve();
    });
};

/**
 * Execute Cloud Run service delete.
 * @param {boolean} verbose - Verbosity.
 * @param {string} platform - Platform for Cloud Run (managed or gke).
 * @param {string} clusterName - GKE cluster name.
 * @param {string} clusterZone - GKE cluster zone location.
 * @param {string} region - Region of service.
 * @param {string} serviceName - Name of service.
 */
const destroyService = function(serviceName, platform, clusterName, clusterZone, region, verbose) {
    let command = ['beta', 'run', 'services', 'delete', serviceName, '--platform=' + platform];
    if (platform === 'managed') {
        command.push('--region=' + region);
    } else if (platform === 'gke') {
        command.push('--cluster=' + clusterName);
        command.push('--cluster-location=' + clusterZone);
    }
    command.push('--quiet');

    // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/beta/run/services/delete
    let serviceRemove = spawn('gcloud', command);
    if (verbose) {
        if (serviceRemove.stdout.toString('utf8') !== '') console.log(serviceRemove.stdout.toString('utf8'));
        if (serviceRemove.stderr.toString('utf8') !== '') console.log(serviceRemove.stderr.toString('utf8'));
    }
    if (serviceRemove.status === 0) {
        console.log(success('Successfully deleted Cloud Run service: ' + varFmt(serviceName)));
        return true;
    } else {
        console.log(failure('Failed to delete Cloud Run service: ' + varFmt(serviceName)));
        return false;
    }
};

/**
 * Parse through and delete image and all of its tags.
 * We have to delete each digest individually to delete the entire image within Container Registry, so we cycle through each and delete.
 * @param {string} serviceName - Name of Service.
 * @param {boolean} verbose - Verbosity.
 */
const destroyImage = function(serviceName, verbose) {
    return new Promise(async (resolve, reject) => {
        let imageDigestDelete, imageDigests;
        let projectName = await getConfig('project', 'name');
        // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/container/images/list-tags
        imageDigests = spawn('gcloud', ['container', 'images', 'list-tags', 'gcr.io/' + projectName + '/' + serviceName, '--format', 'get(digest)']);
        if (verbose) {
            if (imageDigests.stdout.toString('utf8') !== '') console.log(imageDigests.stdout.toString('utf8'));
            if (imageDigests.stderr.toString('utf8') !== '') console.log(imageDigests.stderr.toString('utf8'));
        }
        if (imageDigests.status === 0) {
            var digests = imageDigests.stdout.toString('utf8').split('\n');
            for (var digest in digests) {
                if (digests[digest] !== '') {
                    // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/container/images/delete
                    imageDigestDelete = spawn('gcloud', ['container', 'images', 'delete', 'gcr.io/' + projectName + '/' + serviceName + '@' + digests[digest], '--force-delete-tags']);
                    if (verbose) {
                        console.log(imageDigestDelete.output.toString('utf8'));
                        if (imageDigestDelete.stdout.toString('utf8') !== '') console.log(imageDigestDelete.stdout.toString('utf8'));
                        if (imageDigestDelete.stderr.toString('utf8') !== '') console.log(imageDigestDelete.stderr.toString('utf8'));
                    }
                    if (imageDigestDelete.status === 0) {
                        console.log(success('Deleted image from Container Registry: ' + varFmt(serviceName + '@' + digests[digest])));
                    } else {
                        console.log(failure('Unable to delete image from Container Registry: ' + varFmt(serviceName + '@' + digests[digest])));
                    }
                }
            }
            return resolve();
        } else {
            console.log('Getting container image tags list failed.');
            return reject();
        }
    });
};

module.exports = cloudrun;
