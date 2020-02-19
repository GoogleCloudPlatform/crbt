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

const { success, clc } = require('./colorScheme');

/**
 * Helper function to format printing a command (used with --dryrun).
 * @param {string} command - Base command name.
 * @param {array} args - Arguments for command.
 */
const displayCommand = (command, args) => {
    let cmd = command;
    args.forEach((arg) => {
        if (arg.includes('*')) arg = '"' + arg + '"'; // This catches asterisks when doing a Cloud Scheduler cron command, for example. There is no instance where we pass a wild-card to the shell.
        cmd += ' ' + arg;
    });
    console.log(success('Run the following command: '));
    console.log(clc.yellow('\t' + cmd) + '\n');
};

module.exports = displayCommand;
