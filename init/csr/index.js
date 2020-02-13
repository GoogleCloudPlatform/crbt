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
const spawnSync = require('child_process').spawnSync;
const path = require('path');
const fs = require('fs-extra');
const ncp = require('ncp').ncp; // We use ncp because https://npmjs.com/pkg is not compatible with fs-extra's copy functions. https://github.com/zeit/pkg/issues/420

const displayCommand = require('../../lib/displayCommand');
const { saveConfig } = require('../../lib/parseConfig');
const { success, warn, failure, header, varFmt, clc } = require('../../lib/colorScheme');

/**
 * Handle creation of repository within Cloud Source Repositories.
 * Feature Overview: https://cloud.google.com/source-repositories/
 * Feature Documentation: https://cloud.google.com/source-repositories/docs/
 * * @param {object} options - Initialized from commander.js.
 */
const csr = async (options) => {
    return new Promise(async (resolve, reject) => {
        console.log(header('=== Cloud Source Repository Setup\n'));

        if (options.name !== path.basename(path.resolve()).toLowerCase()) console.log(warn('Repository name and current working directory do not match.')); // Just warn that these do not match for clarity.
        await createRepo(options.name, options.dryrun, options.verbose).catch((e) => {
            process.exit(1);
        });

        if (options.sourcerepo !== undefined) {
            await cloneExternalRepo(options.sourcerepo, options.name, options.verbose, options.dryrun);
            await setRemoteOriginToCSR(options.name, options.verbose, options.dryrun).catch(async (e) => {
                console.log(failure('Failed to set remote origin (' + options.sourcerepo + ').'));
                process.exit(1);
            });
        } else if (options.template !== undefined) {
            initializeGit(options.verbose, options.dryrun);
            await setRemoteOriginToCSR(options.name, options.verbose, options.dryrun).catch(async (e) => {
                console.log(failure('Failed to set remote origin (' + options.sourcerepo + ').'));
                process.exit(1);
            });
            copyGitignore(options.dryrun);
            await templateCopy(options.template).catch((e) => console.log('Error: ' + e));
        } else if (options.local !== undefined) {
            initializeGit(options.verbose, options.dryrun);
            await setRemoteOriginToCSR(options.name, options.verbose, options.dryrun).catch(async (e) => {
                console.log(failure('Failed to set remote origin (' + options.sourcerepo + ').'));
                process.exit(1);
            });
        }

        await saveConfig('cloudrun', options.name);
        return resolve();
    });
};

/**
 * Run git initialization within the current directory.
 * @param {*} verbose - Verbosity level.
 * @param {*} dryrun - Perform the actions or simply do a dry tun test and display what would be done.
 */
const initializeGit = function(verbose, dryrun) {
    if (dryrun) {
        displayCommand('git', ['init']);
        return;
    }

    if (!fs.existsSync('.git')) {
        const initGit = spawnSync('git', ['init']);
        if (verbose) {
            if (initGit.stdout.toString('utf8') !== '') console.log(initGit.stdout.toString('utf8'));
            if (initGit.stderr.toString('utf8') !== '') console.log(initGit.stderr.toString('utf8'));
        }
        if (initGit.status === 0) {
            console.log(success('Initialized git locally.'));
        } else {
            console.log(failure('Unable to initialize git locally. Exiting...'));
            process.exit(1);
        }
    }
};

/**
 * Create the repository within Cloud Source Repositories.
 * @param {object} options - Initialized from commander.js.
 * @param {string} repoName - Repository name to create.
 */
const createRepo = function(repoName, dryrun, verbose) {
    return new Promise((resolve, reject) => {
        // Cloud SDK Reference: https://cloud.google.com/sdk/gcloud/reference/source/repos/create
        let command = ['source', 'repos', 'create', repoName];
        if (dryrun) {
            displayCommand('gcloud', command);
            return resolve();
        }

        const csrCreate = spawn('gcloud', command);
        if (verbose) {
            csrCreate.stdout.pipe(process.stdout);
            csrCreate.stderr.pipe(process.stderr);
        }
        csrCreate.on('error', function(err) {
            console.log('Error creating repo!!');
            return reject();
        });
        csrCreate.on('exit', function(code) {
            if (code === 0) {
                console.log(success('Repository created in Cloud Source Repositories.'));
                return resolve();
            } else {
                console.log(failure('Repository creation in Cloud Source Repositories failed.'));
                return reject();
            }
        });
    });
};

/**
 * Clone from sourceRepo repository and then swap the remote origin to the destinationRepo.
 * @param {string} sourceRepo - Source repository to clone the code from.
 * @param {string} destinationRepo - New repository name to set the origin in git to.
 * @param {*} verbose - Verbosity level.
 * @param {*} dryrun - Perform the actions or simply do a dry tun test and display what would be done.
 */
const cloneExternalRepo = function(sourceRepo, destinationRepo, verbose, dryrun) {
    return new Promise(async (resolve, reject) => {
        let projectName = await getConfig('project', 'name');

        const destionalRepoUrl = 'https://source.developers.google.com/p/' + projectName + '/r/' + destinationRepo;

        if (dryrun) {
            console.log(success('Clone remote git repository.'));
            displayCommand('git', 'clone', sourceRepo, '.');
            displayCommand('git', 'remote', 'rm', 'origin');
            displayCommand('git', 'remote', 'add', 'origin', destionalRepoUrl);
            return resolve();
        }

        const gitClone = spawnSync('git', ['clone', sourceRepo, '.']);

        if (verbose) {
            if (gitClone.stdout.toString('utf8') !== '') console.log(gitClone.stdout.toString('utf8'));
            if (gitClone.stderr.toString('utf8') !== '') console.log(gitClone.stderr.toString('utf8'));
        }
        if (gitClone.status === 0) {
            console.log(success('Repository (' + varFmt(sourceRepo) + ') cloned locally.'));
            return resolve();
        } else {
            console.log(failure('Failed to clone external repository (' + options.sourcerepo + ').'));
            process.exit(1);
        }
    });
};

/**
 * Set the remote origin in git to the CSR repo.
 * @param {string} destinationRepo - New repository name to set the origin in git to.
 * @param {*} verbose - Verbosity level.
 * @param {*} dryrun - Perform the actions or simply do a dry tun test and display what would be done.
 */
const setRemoteOriginToCSR = function(destinationRepo, verbose, dryrun) {
    return new Promise(async (resolve, reject) => {
        const projectName = spawnSync('gcloud', ['config', 'get-value', 'project'])
            .stdout.toString('utf8')
            .trim();
        const destionalRepoUrl = 'https://source.developers.google.com/p/' + projectName + '/r/' + destinationRepo;

        if (dryrun) {
            displayCommand('git', ['remote', 'rm', 'origin']);
            displayCommand('git', ['remote', 'add', 'origin', destionalRepoUrl]);
            return resolve();
        }

        const removeGitOrigin = spawnSync('git', ['remote', 'rm', 'origin']);
        if (verbose) {
            if (removeGitOrigin.stdout.toString('utf8') !== '') console.log(removeGitOrigin.stdout.toString('utf8'));
            if (removeGitOrigin.stderr.toString('utf8') !== '') console.log(removeGitOrigin.stderr.toString('utf8'));
        }

        const addRemoteOrigin = spawnSync('git', ['remote', 'add', 'origin', destionalRepoUrl]);
        if (verbose) {
            if (addRemoteOrigin.stdout.toString('utf8') !== '') console.log(addRemoteOrigin.stdout.toString('utf8'));
            if (addRemoteOrigin.stderr.toString('utf8') !== '') console.log(addRemoteOrigin.stderr.toString('utf8'));
        }
        if (addRemoteOrigin.status === 0) {
            console.log(success('Changed remote origin to Cloud Source Repositories (' + varFmt('/p/' + projectName + '/r/' + destinationRepo) + ').'));
            await saveConfig('repo', 'name', destinationRepo).catch((e) => {});
            return resolve();
        } else {
            return reject();
        }
    });
};

/**
 * Perform the actual directory copy for the template.
 * @param {string} templateName - Template chosen to use as codebase.
 */
function templateCopy(templateName) {
    return new Promise((resolve, reject) => {
        ncp(path.resolve(__dirname, '../../templates/cloudrun/' + templateName), './', function(err) {
            if (err) {
                console.error(err);
                return reject();
            }
            console.log(success('Template (' + varFmt(templateName) + ') copied into `' + varFmt('./') + '`...'));
            return resolve();
        });
    });
}

/**
 * Copy in a default .gitignore.
 */
const copyGitignore = function() {
    const sourceData = fs.readFileSync(path.resolve(__dirname, '../../templates/csr/.gitignore'));
    fs.writeFileSync('./.gitignore', sourceData);
    console.log(success('Template (' + varFmt('.gitignore') + ') copied into ' + varFmt('./') + '...'));
    console.log(warn('By default, the crbt configuration file (' + varFmt('.crbt') + ') is excluded from source control through `.gitignore`.'));
};

module.exports = csr;
