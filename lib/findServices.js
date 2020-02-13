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

/**
 * Find the service URLs of each service, save them to config, and print to output.
 * @param {object} options - Initialized from commander.js.
 */

const spawn = require('child_process').spawnSync;
const Spinner = require('cli-spinner').Spinner;

const { success, failure, warn, header, clc, varFmt } = require('../lib/colorScheme');
const { saveConfig, getConfig } = require('../lib/parseConfig');

/**
 * Find the service URLs of each service, save them to config, and print to output.
 * @param {string} serviceName - Name of service to find.
 * @param {string} type - Type (single, multi) of deployment.
 * @returns {boolean} - True if URL was found.
 */
async function findServices(options) {
    return new Promise(async (resolve, reject) => {
        let services = null;
        let urls = {};
        try {
            services = await getConfig('cloudrun');
        } catch (e) {
            console.log(failure('Unable to read cloudrun section from config. Cannot detect URL automatically.'));
            return resolve();
        }
        if (services !== undefined) {
            for (let serviceName in services) {
                urls[serviceName] = await checkService(serviceName, options.platform, options.cluster, options.clusterzone).catch((e) => {
                    console.log(failure('Error finding service URLs after 5 minutes. Something likely went wrong in the build process. Review Cloud Build logs.'));
                    console.log(warn('If this was unexpected, clean up everything created with: ' + clc.yellow('crbt destroy')));
                    process.exit(1);
                });
                await saveConfig('cloudrun', serviceName, urls[serviceName]);
            }
            console.log();
            for (let url in urls) {
                console.log(success(header('Service URL (' + varFmt(url) + '): ') + clc.greenBright.underline(urls[url])));
            }
        } else {
            console.log(failure('Unable to read cloudrun section from config. Cannot detect URL automatically.'));
            return resolve(true);
        }
        return resolve(true);
    });
}

/**
 * Check the Cloud Run services list until our service appears. Since services are not directly deployed, but rather handed off to a Cloud Build process, we need to check for them becoming live.
 * @param {string} serviceName - Service name.
 */
async function checkService(serviceName, platform, clusterName, clusterZone) {
    return new Promise(async (resolve, reject) => {
        let spinner = new Spinner(warn('Waiting for service availability... %s '));
        spinner.setSpinnerString('|/-\\');
        spinner.start();

        let serviceUrl = null;
        let checkCount = 0;

        let command = ['beta', 'run', 'services', 'list', '--platform=' + platform];
        if (platform === 'gke') {
            command.push('--cluster=' + clusterName);
            command.push('--cluster-location=' + clusterZone);
        }

        while (serviceUrl == null) {
            // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/beta/run/services/
            let serviceSplit = spawn('gcloud', command)
                .stdout.toString('utf8')
                .split(' ');
            for (let i = 0; i < serviceSplit.length; i++) {
                if (serviceSplit[i].includes(serviceName) && serviceSplit[i].includes('http')) {
                    spinner.stop();
                    console.log();
                    serviceUrl = serviceSplit[i];
                    return resolve(serviceUrl);
                }
            }
            if (checkCount > 80) {
                // 80 * 3 secs = 4 minute wait limit.
                spinner.stop();
                console.log();
                return reject();
            }
            await sleep(3000); // Sleep for 3 seconds between checks just to avoid spamming requests.
            checkCount++;
        }
    });
}

/**
 * Helper function to put some sleep time in the code. Useful for helping to prevent spamming external services.
 * @param {integer} ms
 */
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

module.exports = findServices;
