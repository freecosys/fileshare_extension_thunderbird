var uploads = new Map();
let menu_id = messenger.menus.create({
	title: "dont load",
	contexts: [
		"compose_attachments"
	],
});


async function getAccountInfo(accountId) {
	let accountInfo = await browser.storage.local.get([accountId]);
	return accountInfo[accountId];
}

async function xhrUpload(url, data, token_l) {
	return new Promise((resolve, reject) => {
		const uploadRequest = new XMLHttpRequest();

		uploadRequest.addEventListener("load", e => {
			if (e.target.status < 300) {
				resolve(e.target);
			} else {
				reject(e);
			}
		});

		uploadRequest.addEventListener("error", reject);
		uploadRequest.addEventListener("abort", reject);
		uploadRequest.addEventListener("timeout", reject);

		uploadRequest.addEventListener("loadstart", () => console.log('uploading'));
		uploadRequest.upload.addEventListener("progress", e => {
			messenger.menus.update(menu_id, {
				title: (e.total ? Math.floor(e.loaded * 1.0 / e.total * 100) : 0)+"%",
				contexts: [
					"compose_attachments"
				],
			});
		});

		uploadRequest.open("PUT", url);
		uploadRequest.setRequestHeader('Content-Type', 'application/octet-stream');
		uploadRequest.setRequestHeader('Token', token_l);

		uploadRequest.send(data);
	});
}



browser.cloudFile.onFileUpload.addListener(async (account, { id, name, data }) => {
	let accountInfo = await getAccountInfo(account.id); // получаем информацию аккаунта
	let uploadInfo = {id, name, abortController: new AbortController()};
	uploads.set(id, uploadInfo);

	let url = accountInfo.private_url + encodeURIComponent(name);

	let response;
	try {
		response = await xhrUpload(url, data, accountInfo.token_web);
	} catch (error) {
		console.log(error);
		return;
	}

	var uuid_l = JSON.parse(response.responseText).uuid;

	delete uploadInfo.abortController;
	return { url: accountInfo.public_url+uuid_l };
});

browser.cloudFile.onFileUploadAbort.addListener((account, id) => {
	let uploadInfo = uploads.get(id);
	if (uploadInfo && uploadInfo.abortController) {
		uploadInfo.abortController.abort();
	}
});

browser.cloudFile.onFileDeleted.addListener(async (account, id) => {});

browser.cloudFile.getAllAccounts().then(async (accounts) => {
	let allAccountsInfo = await browser.storage.local.get();
	for (let account of accounts) {
		await browser.cloudFile.updateAccount(account.id, {
			configured: account.id in allAccountsInfo,
		});
	}
});

browser.cloudFile.onAccountDeleted.addListener((accountId) => {
	browser.storage.local.remove(accountId);
});
