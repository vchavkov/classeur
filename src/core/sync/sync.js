angular.module('classeur.core.sync', [])
	.run(function($rootScope, $http, $location, clUserSvc, clFolderSvc, clSocketSvc) {
		var lastActivity = 0;
		var maxInactivity = 10 * 1000; // 10 sec

		function updateLastActivity() {
			lastActivity = Date.now();
		}

		var folderSyncData = {};

		function getFolderChangesPage(lastSeq) {
			clSocketSvc.sendMsg({
				type: 'getFolderChanges',
				lastSeq: lastSeq
			});
		}

		function sendFolderChanges() {
			var msg = {
				type: 'setFolderChanges',
				changes: []
			};
			clFolderSvc.folders.forEach(function(folderDao) {
				var syncData = folderSyncData[folderDao.id] || {};
				if(folderDao.updated == syncData.r) {
					return;
				}
				msg.changes.push({
					id: folderDao.id,
					name: folderDao.name,
					updated: folderDao.updated
				});
				syncData.s = folderDao.updated;
				folderSyncData[folderDao.id] = syncData;
			});
			msg.changes.length && clSocketSvc.sendMsg(msg);
		}

		var folderLastSeq = 0;
		clSocketSvc.addMsgHandler('folderChanges', function(msg) {
			updateLastActivity();
			msg.changes.forEach(function(change) {
				var folderDao = clFolderSvc.folderMap[change.id] || clFolderSvc.createFolder();
				var syncData = folderSyncData[change.id] || {};
				if(folderDao.updated != change.updated && syncData.r !== change.updated && syncData.s !== change.updated) {
					folderDao.name = change.name;
					folderDao.write(change.updated);
				}
				folderSyncData[change.id] = {r: change.updated};
				folderLastSeq = change.seq;
			});
			if (msg.lastSeq) {
				folderLastSeq = msg.lastSeq;
				return getFolderChangesPage(folderLastSeq);
			}
			sendFolderChanges();
		});

		function syncFolders() {
			updateLastActivity();
			getFolderChangesPage(folderLastSeq);
		}

		function sync() {
			if (!clSocketSvc.isReady) {
				return;
			}
			if (Date.now() - lastActivity < maxInactivity) {
				return;
			}
			syncFolders();
		}
		$rootScope.$on('clPeriodicRun', sync);
	});
