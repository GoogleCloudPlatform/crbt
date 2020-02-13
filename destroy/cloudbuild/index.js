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

const { getConfig, removeConfigSection } = require('../../lib/parseConfig');
const { success, warn, failure, header, clc } = require('../../lib/colorScheme');

/**
 * Handle destruction of triggers within Cloud Build.
 * Feature Overview: https://cloud.google.com/cloud-build/
 * Feature Documentation: https://cloud.google.com/cloud-build/docs/
 * @param {object} options - Initialized from commander.js.
 */
const cloudbuild = async (options) => {
    return new Promise(async (resolve, reject) => {
        console.log(header('=== Cloud Build Destroy\n'));
        let triggers = null;
        try {
            triggers = getConfig('cloudbuild');
        } catch (e) {
            console.log(failure('Unable to read triggers from config.'));
            console.log(warn('Recommended to check if triggers still exists with: ' + clc.yellow('gcloud beta builds triggers list')));
            console.log(warn('If need to delete manually, delete with: ' + clc.yellow('gcloud beta builds triggers delete [NAME]')));
            return resolve();
        }
        if (triggers !== undefined) {
            for (let trigger in triggers) {
                await destroyTrigger(triggers[trigger], options.verbose).catch((e) => {});
            }
            console.log(success('Removed Cloud Build trigger.'));
            if (!options.preserve) await removeConfigSection('cloudbuild').catch((e) => {});
        } else {
            console.log(warn('No Cloud Build triggers found in config file. Skipping...\n'));
        }
        return resolve();
    });
};

/**
 * Destroy each Cloud Build trigger.
 * @param {object} options - Initialized from commander.js.
 * @param {string} trigger - ID of the trigger to delete.
 */
const destroyTrigger = function(trigger, verbose) {
    return new Promise((resolve, reject) => {
        // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/beta/builds/triggers/delete
        const triggerRemove = spawn('gcloud', ['beta', 'builds', 'triggers', 'delete', trigger, '--quiet']);
        if (verbose) {
            triggerRemove.stdout.pipe(process.stdout);
            triggerRemove.stderr.pipe(process.stderr);
        }
        triggerRemove.on('error', function(err) {
            console.log('Error deleting trigger!!');
            return reject();
        });
        triggerRemove.on('exit', function(code) {
            if (code === 0) {
                console.log(success('Successfully deleted Cloud Build trigger.'));
                return resolve();
            } else {
                console.log(failure('Failed to delete Cloud Build trigger.'));
                return reject();
            }
        });
    });
};

module.exports = cloudbuild;
