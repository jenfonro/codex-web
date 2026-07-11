"use strict";

(function defineCodexPanelAPI(global) {
async function fetchJSON(url, init) {
  const response = await request(url, init);
  return response.json();
}

async function fetchNoContent(url, init) {
  await request(url, init);
}

async function request(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error);
  }
  return response;
}

  global.CodexPanelAPI = {
    fetchJSON,
    fetchNoContent,
  };
})(window);
