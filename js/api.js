const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwTVGuPkANybxLv0nvjJxbruyje2x24zBGPvRX3fDPnBJmtdNGzYVKnYHrw-NDi9giR/exec";

window.google = window.google || {};
window.google.script = window.google.script || {};

function createGASRunner(successHandler, failureHandler) {
    return new Proxy({}, {
        get: function(target, prop) {
            if (prop === 'withSuccessHandler') {
                return function(cb) {
                    return createGASRunner(cb, failureHandler);
                };
            }
            if (prop === 'withFailureHandler') {
                return function(cb) {
                    return createGASRunner(successHandler, cb);
                };
            }
            
            // Execute the actual function call via POST
            return function(...args) {
                const payload = {
                    action: prop,
                    args: args
                };

                // Apps Script requires text/plain to avoid CORS preflight issues on POST
                fetch(GAS_WEB_APP_URL, {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8'
                    }
                })
                .then(res => {
                    if (!res.ok) {
                        throw new Error("HTTP error " + res.status);
                    }
                    return res.json();
                })
                .then(result => {
                    if (result.status === 'success') {
                        if (successHandler) successHandler(result.data);
                    } else {
                        if (failureHandler) failureHandler(new Error(result.message));
                        else console.error("GAS Error:", result.message);
                    }
                })
                .catch(err => {
                    if (failureHandler) failureHandler(err);
                    else console.error("Network/Fetch Error:", err);
                });
            };
        }
    });
}

// Replace the Google Apps Script environment object with our proxy
window.google.script.run = createGASRunner(null, null);
