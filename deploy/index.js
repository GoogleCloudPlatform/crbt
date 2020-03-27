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

const spawn = require('child_process').spawn;
const fs = require('fs-extra');

const customize = require('../customize/envvars/index');
const findServices = require('../lib/findServices');
const { success, failure, header, clc } = require('../lib/colorScheme');
const { checkFileExists } = require('../lib/checkPrereqs.js');

/**
 * This command runs Cloud Build directly; this is primarily used when a Cloud Build trigger wasn't created to automatically run it.
 * @param {object} options - Initialized from commander.js.
 */
const deploy = async function(options) {
    console.log(header('\n=== Cloud Run Service Deployment\n'));

    // We require cloudbuild.yaml for deploy steps in Cloud Build.
    if (checkFileExists('cloudbuild.yaml') == false) {
        console.log(failure('No cloudbuild.yaml found. Please ensure this is being ran inside of a service folder and that project has been initialized with `' + clc.yellow('crbt init') + '`.'));
        process.exit(1);
    }

    // Get the service name by parsing the cloudbuild.yaml file.
    let serviceName = null;
    let cluster = null;
    let clusterzone = null;
    let region = null;

    let cloudbuildyaml = fs
        .readFileSync('cloudbuild.yaml')
        .toString()
        .split('\n');
    for (let line in cloudbuildyaml) {
        if (cloudbuildyaml[line].includes("run', 'deploy")) {
            if (cloudbuildyaml[line].includes('platform=gke')) {
                options.platform = 'gke';
                let splitline = cloudbuildyaml[line]
                    .split('[')[1]
                    .toString()
                    .split(' ');

                serviceName = splitline[3].split("'")[1];
                cluster = splitline[7].split('=')[1].split("'")[0];
                clusterzone = splitline[8].split('=')[1].split("'")[0];
            }
            if (cloudbuildyaml[line].includes('platform=managed')) {
                options.platform = 'managed';
                let splitline = cloudbuildyaml[line]
                    .split('[')[1]
                    .toString()
                    .split(' ');

                serviceName = splitline[3].split("'")[1];
                region = splitline[8].split('=')[1].split("'")[0];
            }
        }
    }

    let command = ['builds', 'submit', '--config', 'cloudbuild.yaml', '.'];
    if (!options.verbose) command.push('--async'); // If user hasn't requested verbose, just go ahead and return -- otherwise, let it run synchronously and pipe output.

    // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/builds/submit
    const buildSubmit = spawn('gcloud', command);
    if (options.verbose) {
        buildSubmit.stdout.pipe(process.stdout);
        buildSubmit.stderr.pipe(process.stderr);
    }

    buildSubmit.on('error', function(err) {
        console.log('Error submitting job to Cloud Build!!');
        return reject();
    });
    buildSubmit.on('exit', async function(code) {
        if (code === 0) {
            console.log(success('Build and deploy successful.'));
            options.name = serviceName;
            options.cluster = cluster;
            options.clusterzone = clusterzone;
            await findServices(options).catch((e) => {
                console.log('Error finding service URL. Something likely went wrong in the build process. Review Cloud Build logs.');
            });
            await customize(options).catch((e) => {});
        } else {
            console.log(failure('Build and deploy failed.'));
        }
    });
};

module.exports = deploy;
