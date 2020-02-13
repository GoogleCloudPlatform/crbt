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

var express = require('express');
var router = express.Router();
var http = require('http');

var project = "Not_Found";

var x = http.request({
  host: 'metadata.google.internal',
  port: 80,
  path: '/computeMetadata/v1/project/project-id',
  method: 'GET',
  headers: {
    'Metadata-Flavor': 'Google'
  }
}, function (res) {
  res.on('data', function (data) {
    project = data;
  });
});

x.on('error', function (err) {
  console.log("Fetching from metadata failed.");
});

x.end();


/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', {
    title: 'Fancy Shop',
    revision: process.env.K_REVISION,
    service: process.env.K_SERVICE,
    project: project
  });
});

/* GET orders page. */
router.get('/orders', function (req, res, next) {
  res.render('orders', {
    title: 'Fancy Shop',
    revision: process.env.K_REVISION,
    service: process.env.K_SERVICE,
    project: project
  });
});

/* GET products page. */
router.get('/products', function (req, res, next) {
  res.render('products', {
    title: 'Fancy Shop',
    revision: process.env.K_REVISION,
    service: process.env.K_SERVICE,
    project: project
  });
});

module.exports = router;
