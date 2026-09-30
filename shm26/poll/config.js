// Poll configuration.
// endpoint: web-app URL of the Google Apps Script deployment (ends with /exec).
// Setup steps: see apps-script/Code.gs. Until the endpoint is set, the poll shows
// "not connected yet" and no answers are sent.
window.POLL_CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfycbyAqxZ0PLZhHTQ1dmEJ1QYj3ObNDhLHKpLrQ9H4WxGcUKciZsfSO9B9OUYmPM8cAzPq/exec",
  pollId: "shm26-ai-share",
  options: [0, 25, 50, 75, 100]
};
