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
const displayCommand = require('../../lib/displayCommand');
const { success, failure, header } = require('../../lib/colorScheme');

/**
 * Add all code, commit it, and push it to Cloud Source Repositories. Cloud Build triggers are based on commits, so this triggers the build process.
 * @param {object} options - Initialized from commander.js.
 */
const git = function(options) {
    console.log(header('=== Code Initialization\n'));

    if (options.dryrun) {
        displayCommand('git', ['add', '.']);
        displayCommand('git', ['commit', '-m', 'Initial Commit from crbt']);
        displayCommand('git', ['push', 'origin', 'master']);
        return;
    }

    const addFolder = spawn('git', ['add', '.']);
    if (addFolder.status === 0) {
        const codeCommit = spawn('git', ['commit', '-m', 'Initial Commit from crbt']);
        if (options.verbose) {
            if (codeCommit.stdout.toString('utf8') !== '') console.log(codeCommit.stdout.toString('utf8'));
            if (codeCommit.stderr.toString('utf8') !== '') console.log(codeCommit.stderr.toString('utf8'));
        }
        if (codeCommit.status === 0) {
            console.log(success('Code committed.'));
            const codePush = spawn('git', ['push', 'origin', 'master']);
            if (options.verbose) {
                if (codePush.stdout.toString('utf8') !== '') console.log(codeCommit.stdout.toString('utf8'));
                if (codePush.stderr.toString('utf8') !== '') console.log(codeCommit.stderr.toString('utf8'));
            }
            if (codePush.status === 0) {
                console.log(success('Pushed to Cloud Source Repositories.\n'));
            } else {
                console.log(failure('Pushing to Cloud Source Repositories failed.'));
            }
        } else {
            console.log(failure('Committing code failed.'));
        }
    } else {
        console.log(failure('Adding folder with git failed.'));
    }
};

module.exports = git;
