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
const { success, warn, failure, header, varFmt } = require('../../lib/colorScheme');

/**
 * Handle destruction of custom domain mappings of Cloud Run services.
 * Feature Overview: https://cloud.google.com/sdk/gcloud/reference/beta/run/domain-mappings
 * @param {object} options - Initialized from commander.js.
 */
const domain = async (options) => {
    return new Promise(async (resolve, reject) => {
        if (options.map === undefined) console.log(header('=== Domain Mapping Destroy\n')); // Don't show if this is called from `customize:domain`
        let mapping = null;
        try {
            mapping = getConfig('mapping');
        } catch (e) {
            console.log(failure('Unable to read custom domain mapping from config.'));
            return resolve();
        }

        if (Array.isArray(mapping)) {
            for (let domain in mapping) {
                await destroyMapping(mapping[domain], options.verbose).catch((e) => {
                    console.log(failure('Failed to delete Custom Domain Mapping: ' + mapping[domain]));
                    return resolve();
                });
                console.log(success('Removed Domain Mapping: ' + mapping[domain]));
            }
            if (!options.preserve) await removeConfigSection('mapping').catch((e) => {});
        } else {
            console.log(warn('No custom domain mappings found in config file. Skipping...\n'));
            if (!options.preserve) await removeConfigSection('mapping').catch((e) => {});
        }
        return resolve();
    });
};

/**
 * Destroy custom domain mapping.
 * @param {object} options - Initialized from commander.js.
 * @param {string} mapping - Name of the mapping to delete.
 */
const destroyMapping = function(mapping, verbose) {
    return new Promise((resolve, reject) => {
        // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/beta/run/domain-mappings/delete
        let region = getConfig('region');
        const mappingRemove = spawn('gcloud', ['beta', 'run', 'domain-mappings', 'delete', '--domain', mapping, '--platform', 'managed', '--region', region]);
        if (verbose) {
            mappingRemove.stdout.pipe(process.stdout);
            mappingRemove.stderr.pipe(process.stderr);
        }
        mappingRemove.on('error', function(err) {
            console.log('Error deleting mapping!!');
            return reject();
        });
        mappingRemove.on('exit', function(code) {
            if (code === 0) {
                console.log(success('Successfully deleted Custom Domain Mapping: ' + varFmt(mapping)));
                return resolve();
            } else {
                return reject();
            }
        });
    });
};

module.exports = domain;
