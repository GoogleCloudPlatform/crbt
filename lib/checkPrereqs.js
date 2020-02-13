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

/**
 * Check if the commands provided are installed. This is done by running the command with the `--version` paramater and checking for the exit code.
 * @param {array} commandsToCheck - Array of strings containing commands to check if installed.
 * @return {array} - Return the of list of not installed programs within rejected promise, or return resolved promise if all installed.
 */
function checkInstalled(commandsToCheck) {
    if (commandsToCheck.length == 0) {
        return;
    }
    let missingPrereqs = [];
    for (let command in commandsToCheck) {
        if (spawn(commandsToCheck[command], ['--version']).status !== 0) {
            missingPrereqs.push(commandsToCheck[command]);
        }
    }
    if (missingPrereqs.length !== 0) {
        console.log(failure('Required pre-requisites not installed: ' + missingPrereqs + '. Exiting...'));
        process.exit(1);
    }
}

/**
 * Check if gcloud is initialized appropriately by checking for a project configured.
 */
function checkGcloudProject() {
    if (spawn('gcloud', ['config', 'get-value', 'project']).status !== 0) {
        console.log(failure('The gcloud command does not appear to be initialized fully: no project is configured. Exiting...'));
        console.log(warn('To fully initialize gcloud: gcloud init'));
        console.log(warn('To set a project: gcloud config set project [NAME]'));
        process.exit(1);
    }
}

/**
 * Helper function to check if a file exists.
 * @param {string} file - File name.
 */
function checkFileExists(file) {
    let fileData = null;
    try {
        fileData = fs.readFileSync(file);
    } catch (e) {}

    if (fileData !== null) {
        return true;
    } else {
        return false;
    }
}

/**
 * Check if th local directory is empty or not.
 * @param {string} dirName - Directory name.
 */
function checkLocalDir(dirName) {
    return new Promise((resolve, reject) => {
        fs.readdir(dirName, function(err, files) {
            if (err) {
                return reject();
            } else {
                if (!files.length) {
                    return resolve();
                } else {
                    return reject();
                }
            }
        });
    });
}

module.exports = {
    checkInstalled,
    checkGcloudProject,
    checkLocalDir,
    checkFileExists
};
