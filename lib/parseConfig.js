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

const fs = require('fs-extra');

const { success, warn, varFmt } = require('./colorScheme');
const { checkFileExists } = require('../lib/checkPrereqs.js');

const configFile = '.crbt';

/*
Expected config file example (JSON):
    {
        "repo": {
            "name": "example-01"
        },
        "project": {
            "name": "proj-example",
            "id": "858773811111",
            "region": "us-east1"
        },
        "cloudrun": {
            "example-01": {
            "url": "https://example-01-gc5t6yxxxx-ue.a.run.app"
            }
        },
        "cloudbuild": {
            "example-01-trigger": "f6c98c0f-5e71-4220-xxxx-d43e59eeeca5"
        }
    }
*/

/**
 * Create or append to the configuration file.
 * @param {string} section - Sections correspond to different service areas (e.g. cloudbuild).
 * @param {string} feature - Feature of Section (e.g. trigger).
 * @param {string} value - Value to set.
 */
function saveConfig(section, feature, value) {
    return new Promise((resolve, reject) => {
        if (checkFileExists(configFile) == false && section === 'cloudrun') return resolve(); // Skip saving this if the file doesn't exist.

        let jsonConfig = {};
        try {
            jsonConfig = JSON.parse(fs.readFileSync(configFile));
        } catch (e) {}

        if (jsonConfig[section] == undefined) {
            jsonConfig[section] = {};
        } // Create second-level if doesn't exist.
        if (section == 'cloudrun') {
            // Cloud Run section has a bit different tree than most.
            jsonConfig[section][feature] = {};
            jsonConfig[section][feature]['url'] = value;
            jsonConfig = JSON.stringify(jsonConfig, null, 2);
        } else if (value == undefined) {
            jsonConfig[section] = feature;
            jsonConfig = JSON.stringify(jsonConfig, null, 2);
        } else {
            jsonConfig[section][feature] = value;
            jsonConfig = JSON.stringify(jsonConfig, null, 2);
        }
        fs.outputFile(configFile, jsonConfig, function(err) {
            if (err) throw err;

            let saveStatement = 'Configuration saved to file (' + varFmt(configFile) + '): ' + varFmt(section) + ' -> ' + varFmt(feature);
            if (value) saveStatement += ' -> ' + varFmt(value);
            console.log(success(saveStatement));
            return resolve();
        });
    });
}

/**
 * Retrieve value from the configuration file.
 * @param {string} section - Sections correspond to different service areas (e.g. cloudbuild).
 * @param {string} feature - Feature of Section (e.g. trigger).
 */
function getConfig(section, feature) {
    let jsonConfig = {};
    try {
        jsonConfig = JSON.parse(fs.readFileSync(configFile));
    } catch (e) {
        return undefined;
    }

    if (section == null) {
        // Return everything if nothing specific is asked for.
        return jsonConfig;
    } else if (feature == null) {
        return jsonConfig[section];
    } else {
        return jsonConfig[section][feature];
    }
}

/**
 * Remove an entire section of config; for example, once a service like Cloud Build is no longer in use, remove the entire `cloudbuild` section.
 * @param {string} section - Sections correspond to different service areas (e.g. cloudbuild).
 */
function removeConfigSection(section) {
    return new Promise((resolve, reject) => {
        //try {
        let jsonConfig = JSON.parse(fs.readFileSync(configFile));

        if (Object.keys(jsonConfig).length > 1 && section == 'project') {
            console.log(warn('Not deleting project from config as other sections remain.')); // We want to keep the project key if the file is not otherwise empty.
            return resolve();
        } else {
            delete jsonConfig[section];
            if (Object.keys(jsonConfig).length === 0) {
                console.log(success('Section removed from config: ' + varFmt(section) + '\n'));
                try {
                    fs.unlinkSync(configFile);
                    console.log(success('Configuration file empty and therefore deleted.'));
                    return resolve();
                } catch (err) {
                    console.error(err);
                }
            } else {
                jsonConfig = JSON.stringify(jsonConfig, null, 2);

                fs.outputFile(configFile, jsonConfig, function(err) {
                    if (err) throw err;
                    console.log(success('Section removed from config: ' + varFmt(section) + '\n'));
                    return resolve();
                });
            }
        }
    });
}

module.exports = { saveConfig, getConfig, removeConfigSection };
