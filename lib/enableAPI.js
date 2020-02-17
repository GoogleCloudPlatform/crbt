/**
 * Copyright 2020 Google LLC
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
const displayCommand = require('./displayCommand');

const { success, failure, varFmt } = require('./colorScheme');

/**
 * Check if a Cloud API is enabled and if not then enable it, which will allow usage of the service.
 * @param {string} service - GCP Service to enable.
 */
const enableAPI = (service, dryrun, verbose) => {
    let command = ['services', 'enable', service + '.googleapis.com'];
    if (dryrun) {
        displayCommand('gcloud', command);
        return;
    }
    let serviceEnable = spawn('gcloud', command);
    if (verbose) {
        if (serviceEnable.stdout.toString('utf8') !== '') console.log(serviceEnable.stdout.toString('utf8'));
        if (serviceEnable.stderr.toString('utf8') !== '') console.log(serviceEnable.stderr.toString('utf8'));
    }
    if (serviceEnable.status === 0) {
        console.log(success('Services API enabled: ' + varFmt(service)));
    } else {
        console.log(failure('Services API failed to enable: ' + varFmt(service)));
        process.exit(1);
    }
};

module.exports = enableAPI;
