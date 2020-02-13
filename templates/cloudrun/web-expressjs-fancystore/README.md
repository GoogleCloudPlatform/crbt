# web-expressjs-fancystore

This [Cloud Run](https://cloud.google.com/run/) service is designed to simple web site with a built-in API for `orders` and `products`. This application is just a template that can be extended with a true data source using something like Cloud SQL instead of flat files.

**Disclaimer: This is not an officially supported Google project.**

## Testing

Try accessing the following URLs:

https://[SERVICE_URL]/
https://[SERVICE_URL]/products
https://[SERVICE_URL]/orders
https://[SERVICE_URL]/api/orders
https://[SERVICE_URL]/api/orders/ORD-000003-MICROSERVICE
https://[SERVICE_URL]/api/products/OLJCESPC7Z

Variable definitions:

-   [SERVICE_URL]: URL of the Cloud Run service.
