const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbylNeFfOQtmsbV8EikkIHCVevzSrIwUf2Pjv-HaeaoVIok3IS4paFbWT2cKcu7EJ_Qg/exec";

window.google = window.google || {};
window.google.script = window.google.script || {};

const requestCache = {};
const CACHEABLE_ACTIONS = ['getMasterData', 'getWorksData'];

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

                // Check cache first for certain read-only actions
                const cacheKey = prop + '_' + JSON.stringify(args);
                if (CACHEABLE_ACTIONS.includes(prop) && requestCache[cacheKey]) {
                    // console.log("Cache hit for", prop);
                    if (successHandler) successHandler(requestCache[cacheKey]);
                    return;
                }

                const maxRetries = 2;
                let attempt = 0;

                const attemptFetch = () => {
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
                            if (CACHEABLE_ACTIONS.includes(prop)) {
                                requestCache[cacheKey] = result.data;
                            }
                            if (successHandler) successHandler(result.data);
                        } else {
                            if (failureHandler) failureHandler(new Error(result.message));
                            else console.error("GAS Error:", result.message);
                        }
                    })
                    .catch(err => {
                        attempt++;
                        if (attempt <= maxRetries) {
                            console.warn(`API call failed. Retrying ${attempt}/${maxRetries} in ${attempt}s...`, err);
                            setTimeout(attemptFetch, 1000 * attempt);
                        } else {
                            if (failureHandler) failureHandler(err);
                            else console.error("Network/Fetch Error after retries:", err);
                        }
                    });
                };
                
                attemptFetch();
            };
        }
    });
}

// Replace the Google Apps Script environment object with our proxy
window.google.script.run = createGASRunner(null, null);
