var fs = require('fs');
const axios = require('axios').default;
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
axiosCookieJarSupport(axios);
const { v4: uuidv4 } = require('uuid');


async function getTimestamp() {
    return Math.floor(Date.now() / 1000);
}

const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

async function getSession(orderNumber, orderEmail, cookieJar) {
    axios({
        method: 'get',
        url: ' https://www.footlocker.com/api/v3/session?timestamp=' + await getTimestamp(),
        jar: cookieJar,
        withCredentials: true,
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36',
        }
    }).then(response => {
        checkOrder(response.data.data.csrfToken, uuidv4(), orderNumber, orderEmail, cookieJar)
    }).catch(error => {
        console.log("Error getting csrfToken")
        sleep(5000).then(() => {
            getSession()
        });
    })
}

async function checkOrder(csrfToken, uuid, orderNumber, orderEmail, cookieJar) {
    axios({
        method: 'post',
        url: ' https://www.footlocker.com/api/users/orders/status?timestamp=' + await getTimestamp(),
        jar: cookieJar,
        withCredentials: true,
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36',
            'x-csrf-token': csrfToken,
            'x-fl-request-id': uuid
        },
        data: {
            'code': orderNumber.trim(),
            'customerEmail': orderEmail.trim()
        }
    }).then(response => {
        sendWebhook(response.data)
    }).catch(error => {
        console.log("Error checking order #" + orderNumber)
    })
}

async function sendWebhook(order) {
    var webhookLink = fs.readFileSync("./webhook.txt", 'utf8');
    let carrier = 'N/A';
    let tracking = 'N/A';
    let shipping2 = 'N/A'
    let billing2 = 'N/A'
    if (order.shipAddresses[0].street2.length > 0) {
        shipping2 = order.shipAddresses[0].street2
    }
    if (order.billContact.street2.length > 0) {
        billing2 = order.billContact.street2
    }
    if (order.shipments[0].shipMethod.length > 0) {
        carrier = await order.shipments[0].shipMethod
        tracking = await order.shipments[0].trackingNumber
    }
    axios({
            method: 'post',
            url: webhookLink,
            data: {
                "content": null,
                "embeds": [{
                    "title": "Order #" + order.orderNumber,
                    "color": 15660533,
                    "fields": [{
                            "name": "Product Title",
                            "value": order.lineItems[0].productDescription
                        },
                        {
                            "name": "Order Date",
                            "value": order.orderDate,
                            "inline": true
                        },
                        {
                            "name": "Current Status",
                            "value": order.orderStatus,
                            "inline": true
                        },
                        {
                            "name": "Shipping First Name",
                            "value": order.shipAddresses[0].firstName
                        },
                        {
                            "name": "Shipping Last Name",
                            "value": order.shipAddresses[0].lastName
                        },
                        {
                            "name": "Shipping Address 1",
                            "value": order.shipAddresses[0].street1,
                            "inline": true
                        },
                        {
                            "name": "Shipping Address 2",
                            "value": shipping2,
                            "inline": true
                        },
                        {
                            "name": "Shipping City",
                            "value": order.shipAddresses[0].city
                        },
                        {
                            "name": "Shipping State",
                            "value": order.shipAddresses[0].state,
                            "inline": true
                        },
                        {
                            "name": "Shipping Zip",
                            "value": order.shipAddresses[0].zip,
                            "inline": true
                        },
                        {
                            "name": "Shipping Country",
                            "value": order.shipAddresses[0].countryName,
                            "inline": true
                        },
                        {
                            "name": "Billing First Name",
                            "value": order.billContact.firstName
                        },
                        {
                            "name": "Billing Last Name",
                            "value": order.billContact.lastName
                        },
                        {
                            "name": "Billing Address 1",
                            "value": order.billContact.street1,
                            "inline": true
                        },
                        {
                            "name": "Billing Address 2",
                            "value": billing2,
                            "inline": true
                        },
                        {
                            "name": "Billing City",
                            "value": order.billContact.city
                        },
                        {
                            "name": "Billing State",
                            "value": order.billContact.state,
                            "inline": true
                        },
                        {
                            "name": "Bililng Zip",
                            "value": order.billContact.zip,
                            "inline": true
                        },
                        {
                            "name": "Billing Country",
                            "value": order.billContact.countryName,
                            "inline": true
                        },
                        {
                            "name": "Order Total",
                            "value": order.orderTotal
                        },
                        {
                            "name": "Shipping Carrier",
                            "value": carrier
                        },
                        {
                            "name": "Tracking Number",
                            "value": tracking
                        }
                    ]
                }],
                "username": "Footsites Order Checker"
            }
        }).then(response => {
            console.log("Finished checking order #" + order.orderNumber)
        })
        .catch(error => {
            console.log("Error sending webhook")
            sleep(5000).then(() => {
                sendWebhook(order)
            });
        })
}

async function checkOrders() {
    var csv_string = fs.readFileSync("./orders.csv", 'utf8');
    var lines = csv_string.split('\n');
    for (var i = 0; i < lines.length; i++) {
        var orderDetails = lines[i].split(',')
        getSession(orderDetails[0], orderDetails[1], new tough.CookieJar())
        if (i != lines.length - 1)
            await sleep(3000)
    }
}

checkOrders()