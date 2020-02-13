# Copyright 2019 Google LLC
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#     https://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

FROM google/cloud-sdk:latest

# Create app directory
WORKDIR /usr/src/app

# Install NodeJS
RUN apt-get update
RUN apt-get install curl gnupg -y 
RUN curl -sL https://deb.nodesource.com/setup_12.x  | bash -
RUN apt-get install nodejs -y
RUN npm install

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

# Set port
ENV PORT 8080

EXPOSE 8080
CMD [ "node", "app.js" ]