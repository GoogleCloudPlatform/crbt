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
var PRODUCTS_API_URL = window.location.protocol + '//' + window.location.hostname + ((window.location.port != "") ? `:${window.location.port}` : "") + '/api/products';

function init() {

    getProducts();

}

function getProducts() {

    console.log('Calling Service at: ' + PRODUCTS_API_URL);

    $.ajax({
        method: 'GET',
        url: PRODUCTS_API_URL,
        /*headers: {
            Authorization: 'Bearer ' + token
        },*/
        error: function () {
            $("#response").text("There was an error");
        },
        success: function (data) {

            /*
            <div class="col s12 m4">
                <div class="card">
                    <div class="card-image">
                        <img src="images/typewriter.jpg">
                        <a class="btn-floating btn-large halfway-fab waves-effect waves-light red"><i
                                class="material-icons">add</i></a>
                    </div>
                    <div class="card-content">
                        <span class="card-title">Vintage Typewriter</span>
                        <p>MSRP: $67.99</p>
                    </div>
                </div>
            </div>
            */
            var trHTML = '';
            var itemCount = 1;
            $.each(data, function (i, item) {
                itemCount++;
                if (itemCount % 2 == 0) {
                    trHTML += '<div class="row">';
                }
                trHTML += '<div class="col s12 l6"><div class="card"><div class="card-image"><img src="' + item.picture + '"><a class="btn-floating btn-large halfway-fab waves-effect waves-light grey darken-3"><i class="material-icons">add</i></a></div>';
                trHTML += '<div class="card-content"><span class="card-title">' + item.name + '</span><p>MSRP: ' + item.cost + '</p></div></div></div>';
                if (itemCount % 2 == 1) {
                    trHTML += '</div>';
                }
            });
            if (itemCount % 2 == 0) {
                trHTML += '</div>';
            }
            $('#products-list').append(trHTML);
        }
    });

};

window.onload = init;