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

// Set the API URL using the page's location. If doing firebase local testing then it is likely done on a non-standard port, which is why we add the logic to include that if necessary.
var ORDERS_API_URL = window.location.protocol + '//' + window.location.hostname + ((window.location.port != "") ? `:${window.location.port}` : "") + '/api/orders';

function init() {
    getOrders();
}

// Does an authenticated request to a Firebase Functions endpoint using an Authorization header.
function getOrders() {

    console.log('Calling Service at: ' + ORDERS_API_URL);

    $.ajax({
        method: 'GET',
        url: ORDERS_API_URL,
        /*headers: {
            Authorization: 'Bearer ' + token
        },*/
        error: function () {
            $("#response").text("There was an error");
        },
        success: function (data) {
            var trHTML = '';
            $.each(data, function (i, item) {
                trHTML += '<tr><td>' + item.id + '</td><td>' + item.date + '</td><td>' + item.items.length + '</td><td>' + item.cost + '</td></tr>';
            });
            $('#orders-table').append(trHTML);
        }
    });

};

window.onload = init;