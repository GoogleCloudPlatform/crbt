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

const { removeConfigSection, getConfig } = require('../../lib/parseConfig');
const { success, warn, failure, header, clc } = require('../../lib/colorScheme');

/**
 * Handle destruction of repository within Cloud Source Repositories.
 * Feature Overview: https://cloud.google.com/source-repositories/
 * Feature Documentation: https://cloud.google.com/source-repositories/docs/
 * @param {object} options - Initialized from commander.js.
 */
const csr = async (options) => {
    return new Promise(async (resolve, reject) => {
        console.log(header('=== Cloud Source Repository Destroy\n'));
        await destroyRepo(options.repo, options.preserve, options.verbose).catch((e) => {});
        return resolve();
    });
};

/**
 * Delete the Cloud Source Repositories repository.
 * @param {string} repo - Repository name.
 * @param {boolean} preserve - Don't delete the value within the `.crbt` configuration value.
 * @param {boolean} verbose - Output verbosity.
 */
const destroyRepo = function(repo, preserve, verbose) {
    return new Promise(async (resolve, reject) => {
        let repoName = '';
        if (!repo) {
            try {
                repoName = getConfig('repo', 'name');
            } catch (e) {
                console.log(failure('Unable to read repo name from config.'));
                console.log(warn('Recommended to check if repository still exists with: ' + clc.yellow('gcloud source repos list')));
                console.log(warn('If need to delete manually, delete with: ' + clc.yellow('gcloud source repos delete [NAME]')));
                return reject();
            }
        } else {
            repoName = repo;
        }

        // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/source/repos/delete
        const csrRemove = spawn('gcloud', ['source', 'repos', 'delete', repoName, '--quiet']);
        if (verbose) {
            csrRemove.stdout.pipe(process.stdout);
            csrRemove.stderr.pipe(process.stderr);
        }
        csrRemove.on('error', function(err) {
            console.log('Error deleting repo!!');
            return reject();
        });
        csrRemove.on('exit', async function(code) {
            if (code === 0) {
                console.log(success('Successfully deleted Cloud Source Repository'));
                if (!preserve) await removeConfigSection('repo').catch((e) => {});
                return resolve();
            } else {
                console.log(failure('Failed to delete Cloud Source Repository.'));
                console.log(warn('Recommended to check if repository still exists with: ' + clc.yellow('gcloud source repos list')));
                console.log(warn('If need to delete manually, delete with: ' + clc.yellow('gcloud source repos delete [NAME]')));
                return reject();
            }
        });
    });
};

module.exports = csr;
