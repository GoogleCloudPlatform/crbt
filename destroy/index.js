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

const cloudrun = require('./cloudrun/index');
const csr = require('./csr/index');
const cloudbuild = require('./cloudbuild/index');
const domain = require('./domain/index');

const { getConfig, removeConfigSection } = require('../lib/parseConfig');
const { clc, header, failure, warn, highlight, questionPrefix, varFmt } = require('../lib/colorScheme');
const { checkInstalled, checkGcloudProject, checkFileExists } = require('../lib/checkPrereqs.js');

/**
 * Handle destruction of services previously created. Only runs if the current directory has a .crbt file and utilizes that to determine what to remove.
 * @param {object} options - Initialized from commander.js.
 */
const destroy = async function(options) {
    // Perform pre-requisite checks.
    checkInstalled(['git', 'gcloud']); // Check for needed programs.
    checkGcloudProject(); // Check if gcloud is initialized sufficiently.

    const TEMPLATE_ROOT = path.resolve(__dirname, '../templates/');
    const BANNER_TEXT = fs.readFileSync(path.join(TEMPLATE_ROOT, 'banner.txt'), 'utf8');
    console.log(header(BANNER_TEXT));
    let mode = 'all'; // By default, assuming 'all' mode to destroy everything.

    // If there is no .crbt file but there is a cloudbuild.yaml, delete just the cloudrun service.
    if (checkFileExists('.crbt') == false) {
        if (checkFileExists('cloudbuild.yaml')) {
            console.log(warn('\nNo .crbt config file detected, but cloudbuild.yaml detected. Destroying Cloud Run service only.'));
            mode = 'cloudrun';
        }
    }

    if (mode == 'all') {
        // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/config/get-value
        // Make sure that the project that is configured within the gcloud command matches the project listed in the configuration file.
        // If these do not match up, damage could be done to the wrong project.
        let currentProject = spawn('gcloud', ['config', 'get-value', 'project'])
            .stdout.toString('utf8')
            .trim();
        let configProject;
        try {
            configProject = getConfig('project', 'name');
        } catch (e) {
            console.log(failure('Error getting project name from config. Exiting.'));
            process.exit(1);
        }

        if (currentProject !== configProject) {
            console.log();
            console.log(failure('Current `gcloud` configured project (' + varFmt(currentProject) + ') does not match the project configured within the crbt configuration file (' + varFmt(configProject) + ').'));
            process.exit(1);
        }
        console.log('\nYou’re about to ' + clc.red('destroy') + ' a crbt project in this directory: \n\n' + highlight(process.cwd() + '\n'));
    } else if (mode == 'cloudrun') {
        console.log('\nYou’re about to ' + clc.red('destroy') + ' the Cloud Run service within this directory: \n\n' + highlight(process.cwd()) + '\n');
    }

    if (options.yes) {
        let answers = {};
        answers.confirmDestroy = 'Yes';
        main(options, answers, mode);
    } else {
        inquirer
            .prompt([
                {
                    type: 'list',
                    name: 'confirmDestroy',
                    prefix: questionPrefix,
                    message: 'This destructive action is irreversible. Proceed?',
                    choices: ['Yes', 'No']
                }
            ])
            .then(async function(answers) {
                main(options, answers, mode);
            });
    }
};

/**
 * Kick off the actual destruction process to each feature.
 * @param {object} options - Initialized from commander.js.
 * @param {object} answers - Initialized from Inquirer.js when interactive or directly created if argument passed in.
 * @param {string} mode - Specify whether to delete all or just cloudrun
 */
async function main(options, answers, mode) {
    if (answers.confirmDestroy === 'Yes') {
        if (mode == 'cloudrun') {
            cloudrun(options);
        } else {
            await csr(options);
            await cloudbuild(options);
            await cloudrun(options);
            await domain(options);

            // All of these values will exist in a properly deployed configuration file, but aren't directly removed as part of any cleanup function.
            if (!options.preserve) {
                console.log(header('=== Project Cleanup\n'));
                await removeConfigSection('name').catch((e) => {
                    console.log(failure('Unable to remove name section from config file.'));
                });
                await removeConfigSection('region').catch((e) => {
                    console.log(failure('Unable to remove region section from config file.'));
                });
                await removeConfigSection('options').catch((e) => {
                    console.log(failure('Unable to remove options section from config file.'));
                });
                await removeConfigSection('env').catch((e) => {
                    console.log(failure('Unable to remove env section from config file.'));
                });
                await removeConfigSection('project').catch((e) => {
                    console.log(failure('Unable to remove project section from config file.'));
                    console.log(warn('Recommended to check if any configuration remains in config (' + varFmt('.crbt') + ').'));
                });
            }
            console.log(highlight('\ncrbt project destroyed!'));
        }
    } else if (answers.confirmDestroy === 'No') {
        console.log(failure('Exiting. Project will not be destroyed.'));
    }
}

module.exports = destroy;
