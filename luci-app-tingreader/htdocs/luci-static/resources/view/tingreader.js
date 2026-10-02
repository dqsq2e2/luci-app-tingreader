'use strict';
'require dom';
'require fs';
'require form';
'require poll';
'require rpc';
'require ui';
'require uci';
'require view';

var callStatus = rpc.declare({
	object: 'luci.tingreader',
	method: 'status',
	expect: { '': {} }
});

var callInfo = rpc.declare({
	object: 'luci.tingreader',
	method: 'info',
	expect: { '': {} }
});

var callAction = rpc.declare({
	object: 'luci.tingreader',
	method: 'action',
	params: [ 'action' ],
	expect: { '': {} }
});

var callDownload = rpc.declare({
	object: 'luci.tingreader',
	method: 'download',
	params: [ 'version', 'directory', 'mirror' ],
	expect: { '': {} }
});

var callDownloadStatus = rpc.declare({
	object: 'luci.tingreader',
	method: 'download_status',
	expect: { '': {} }
});

var callCancelDownload = rpc.declare({
	object: 'luci.tingreader',
	method: 'cancel_download',
	expect: { '': {} }
});

var statusNode;
var downloadBusy = false;

function notifyError(message) {
	ui.addNotification(null, E('p', message), 'error');
}

function withPercent(value) {
	value = String(value == null || value === '' ? '0' : value);
	return /%$/.test(value) ? value : value + '%';
}

function formatBytes(bytes) {
	bytes = +bytes || 0;
	if (bytes >= 1024 * 1024 * 1024 * 1024)
		return '%.1f TiB'.format(bytes / 1024 / 1024 / 1024 / 1024);
	if (bytes >= 1024 * 1024 * 1024)
		return '%.1f GiB'.format(bytes / 1024 / 1024 / 1024);
	if (bytes >= 1024 * 1024)
		return '%.1f MiB'.format(bytes / 1024 / 1024);
	return '%.1f KiB'.format(bytes / 1024);
}

function managementUrl() {
	var host = uci.get('tingreader', 'main', 'listen_addr') || window.location.hostname;
	var port = uci.get('tingreader', 'main', 'listen_port') || '3000';

	if (host === '0.0.0.0' || host === '127.0.0.1' || host === 'localhost' ||
	    host === '::' || host === '::1' || host === '[::]' || host === '[::1]')
		host = window.location.hostname;

	if (host.indexOf(':') >= 0 && host.charAt(0) !== '[')
		host = '[' + host + ']';

	return 'http://' + host + ':' + port + '/';
}

function runServiceAction(action, button) {
	if (button)
		button.disabled = true;

	return callAction(action).then(function(result) {
		if (!result || !result.success)
			throw new Error(result && result.message || _('Service command failed with exit code %s.').format(result && result.code));

		return new Promise(function(resolve) {
			window.setTimeout(resolve, 900);
		});
	}).then(updateStatus).catch(function(err) {
		notifyError(_('Service action failed: %s').format(err.message || err));
	}).finally(function() {
		if (button)
			button.disabled = false;
	});
}

function actionButton(label, style, action) {
	return E('button', {
		'type': 'button',
		'class': 'btn cbi-button cbi-button-' + style,
		'click': function(ev) {
			ev.preventDefault();
			return runServiceAction(action, ev.currentTarget);
		}
	}, [ label ]);
}

function readLog(kind) {
	return fs.exec('/usr/libexec/tingreader-read-log', [ kind ]).then(function(result) {
		if (result.code)
			throw new Error(result.stderr || _('Log reader exited with code %s.').format(result.code));

		return result.stdout || _('No log entries were found.');
	});
}

function showLogs() {
	var selected = 'system';
	var logNode = E('textarea', {
		'class': 'cbi-input-textarea',
		'readonly': 'readonly',
		'wrap': 'off',
		'spellcheck': 'false',
		'style': 'display:block;width:100%;height:60vh;box-sizing:border-box;resize:none;overflow:auto;white-space:pre;font-family:monospace'
	}, [ _('Loading...') ]);
	var systemTab;
	var pluginTab;

	function selectLog(kind) {
		selected = kind;
		systemTab.className = kind === 'system' ? 'cbi-tab' : 'cbi-tab-disabled';
		pluginTab.className = kind === 'plugin' ? 'cbi-tab' : 'cbi-tab-disabled';
		logNode.value = _('Loading...');

		return readLog(kind).then(function(content) {
			logNode.value = content;
			logNode.scrollTop = logNode.scrollHeight;
		}).catch(function(err) {
			logNode.value = '';
			notifyError(_('Unable to read logs: %s').format(err.message || err));
		});
	}

	systemTab = E('li', { 'class': 'cbi-tab' }, [
		E('a', {
			'href': '#',
			'click': function(ev) {
				ev.preventDefault();
				return selectLog('system');
			}
		}, [ _('System log') ])
	]);
	pluginTab = E('li', { 'class': 'cbi-tab-disabled' }, [
		E('a', {
			'href': '#',
			'click': function(ev) {
				ev.preventDefault();
				return selectLog('plugin');
			}
		}, [ _('Plugin log') ])
	]);

	ui.showModal(_('Ting Reader logs'), [
		E('ul', { 'class': 'cbi-tabmenu' }, [ systemTab, pluginTab ]),
		logNode,
		E('div', { 'class': 'right', 'style': 'margin-top:12px' }, [
			E('button', {
				'type': 'button',
				'class': 'btn cbi-button cbi-button-reload',
				'click': function(ev) {
					ev.preventDefault();
					return selectLog(selected);
				}
			}, [ _('Refresh') ]),
			' ',
			E('button', {
				'type': 'button',
				'class': 'btn',
				'click': ui.hideModal
			}, [ _('Close') ])
		])
	]);

	selectLog('system');
}

function renderStatus(status) {
	var enabled = uci.get('tingreader', 'main', 'enabled') === '1';
	var running = !!(status && status.running);
	var exists = !!(status && status.exists);
	var details = [];
	var buttons = [];

	if (running) {
		if (status.pid)
			details.push(_('PID %s').format(status.pid));
		details.push(_('CPU %s').format(withPercent(status.cpu)));
		details.push(_('MEM %s').format(status.memory == null ? _('Unknown') : withPercent(status.memory)));

		buttons.push(E('button', {
			'type': 'button',
			'class': 'btn cbi-button cbi-button-action',
			'click': function(ev) {
				ev.preventDefault();
				window.open(managementUrl(), '_blank', 'noopener,noreferrer');
			}
		}, [ _('Open Ting Reader') ]));
		buttons.push(actionButton(_('Restart'), 'reload', 'restart'));
	}
	else if (exists && enabled) {
		buttons.push(actionButton(_('Start'), 'apply', 'start'));
	}
	if (!exists)
		details.push(_('Download the program in Program management before starting the service.'));

	buttons.forEach(function(button) {
		button.disabled = downloadBusy;
	});

	buttons.push(E('button', {
		'type': 'button',
		'class': 'btn cbi-button',
		'click': function(ev) {
			ev.preventDefault();
			showLogs();
		}
	}, [ _('View logs') ]));

	return E('div', {}, [
		E('div', { 'style': 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:32px' }, [
			E('strong', {
				'style': 'color:' + (running ? '#2d8a34' : '#c33')
			}, [ running ? _('Running') : _('Not running') ]),
			details.length ? E('span', {}, [ '(' + details.join(', ') + ')' ]) : ''
		]),
		E('div', { 'style': 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px' }, buttons)
	]);
}

function updateStatus() {
	if (!statusNode)
		return Promise.resolve();

	return L.resolveDefault(callStatus(), {}).then(function(status) {
		dom.content(statusNode, renderStatus(status));
	});
}

function renderStatusSection() {
	statusNode = E('div', {}, [ _('Collecting data...') ]);
	poll.add(updateStatus, 5);
	updateStatus();

	return E('div', { 'class': 'cbi-section' }, [ statusNode ]);
}

function validatePath(sectionId, value) {
	if (value == null || value === '')
		return true;
	if (value.charAt(0) !== '/')
		return _('The path must be absolute.');
	if (/(^|\/)\.\.(\/|$)/.test(value))
		return _('The path must not contain parent-directory components.');

	return true;
}

function renderDownloadSection(info, defaultDataDir, mounts) {
	var supported = /^(x86_64|aarch64|arm64)$/.test(info.architecture || '');
	var version = E('input', {
		'type': 'text', 'class': 'cbi-input-text', 'value': 'latest',
		'placeholder': _('latest or a version such as 2.0.0')
	});
	var choices = {};
	mounts.forEach(function(mount) {
		var path = String(mount.path).replace(/\/+$/, '') + '/tingreader/program';
		choices[path] = path;
	});
	var initialDir = uci.get('tingreader', 'main', 'program_dir') || defaultDataDir + '/program';
	choices[initialDir] = initialDir;
	var directory = new ui.Dropdown(initialDir, choices, {
		create: true, optional: false,
		custom_placeholder: _('Enter a custom absolute path')
	});
	var proxies = {
		auto: _('Automatic (try accelerators, then GitHub)'),
		direct: _('GitHub direct'),
		'https://ghproxy.net/': 'https://ghproxy.net/',
		'https://gh-proxy.com/': 'https://gh-proxy.com/',
		'https://ghfast.top/': 'https://ghfast.top/'
	};
	L.toArray(uci.get('tingreader', 'main', 'github_proxies')).forEach(function(proxy) {
		proxies[proxy] = proxy;
	});
	var mirror = new ui.Dropdown(uci.get('tingreader', 'main', 'github_proxy') || 'auto', proxies, {
		create: true, optional: false,
		custom_placeholder: _('Custom HTTPS accelerator URL')
	});
	var installed = E('span');
	var message = E('p', { 'style': 'margin:8px 0;overflow-wrap:anywhere' });
	var progress = E('progress', {
		'max': 100, 'value': 0, 'style': 'width:100%;height:14px;display:none'
	});
	var details = E('small', { 'style': 'display:block;margin-top:4px' });
	var errors = {
		download_failed: _('Download failed. Try another accelerator or GitHub direct.'),
		checksum_failed: _('Checksum verification failed. The installed program was kept.'),
		invalid_manifest: _('Invalid Release manifest. Please check the requested version.'),
		invalid_archive: _('Invalid program archive. The installed program was kept.'),
		verify_failed: _('The downloaded program cannot run on this device.'),
		unsupported_arch: _('No backend Release is available for this architecture.'),
		invalid_directory: _('Choose a dedicated absolute program directory without spaces or symlinks.'),
		invalid_arguments: _('Invalid download settings.'),
		no_space: _('Not enough free space in the program directory.'),
		install_failed: _('Installation failed. The previous program was restored.'),
		start_failed: _('The service could not restart. The previous program was restored.'),
		stop_failed: _('The service could not stop. The installed program was kept.'),
		interrupted: _('The download was interrupted.')
	};
	var phases = {
		queued: _('Preparing download...'),
		manifest: _('Reading Release information...'),
		backend: _('Downloading backend...'),
		frontend: _('Downloading Web frontend...'),
		checksum: _('Verifying program files...'),
		switching: _('Installing program...'),
		done: _('Program installed. Enable the service in Configuration and apply.')
	};
	var downloadButton = E('button', {
		'type': 'button', 'class': 'btn cbi-button cbi-button-apply',
		'disabled': !supported,
		'click': function(ev) {
			ev.preventDefault();
			var requested = version.value.trim();
			var path = String(directory.getValue() || '').replace(/\/+$/, '');
			var proxy = String(mirror.getValue() || '');
			if (!/^(latest|v?\d+\.\d+\.\d+(-[A-Za-z0-9]+([.-][A-Za-z0-9]+)*)?)$/.test(requested) ||
			    !/^\/[A-Za-z0-9_./-]+$/.test(path) || /(^|\/)\.\.?($|\/)|\/\//.test(path) ||
			    !/^(auto|direct|https:\/\/[A-Za-z0-9_./:~-]+)$/.test(proxy)) {
				notifyError(_('Enter a valid version, absolute program path and HTTPS accelerator URL.'));
				return;
			}
			downloadButton.disabled = true;
			return callDownload(requested, path, proxy).then(function(result) {
				if (!result.success)
					throw new Error(result.code === 3 ? _('A download is already in progress.') : _('Unable to start download. Check the program directory.'));
				return update();
			}).catch(function(err) {
				notifyError(err.message || err);
				downloadButton.disabled = !supported;
			});
		}
	}, [ _('Download / Update') ]);
	var cancelButton = E('button', {
		'type': 'button', 'class': 'btn cbi-button cbi-button-reset', 'disabled': true,
		'click': function(ev) {
			ev.preventDefault();
			cancelButton.disabled = true;
			return callCancelDownload().catch(function(err) {
				notifyError(err.message || err);
			});
		}
	}, [ _('Cancel download') ]);

	function update() {
		return callDownloadStatus().then(function(state) {
			downloadBusy = !!state.busy;
			version.disabled = downloadBusy;
			downloadButton.disabled = downloadBusy || !supported;
			cancelButton.disabled = !downloadBusy || state.phase === 'switching';
			progress.style.display = downloadBusy ? 'block' : 'none';
			progress.value = +state.percent || 0;
			dom.content(installed, state.version_installed || _('Not installed'));
			var text = state.state === 'error' ? (errors[state.error] || _('Installation failed.')) :
				state.state === 'cancelled' ? _('Download cancelled. The installed program was kept.') :
				phases[state.phase] || _('Select a version and download the backend and Web frontend together.');
			if (!state.busy && state.state && state.state !== 'complete' && state.state !== 'error' && state.state !== 'cancelled')
				text = _('The download was interrupted.');
			dom.content(message, supported ? text : errors.unsupported_arch);
			dom.content(details, downloadBusy
				? '%s · %s%% · %s / %s'.format(state.version || 'latest', state.percent || 0,
					formatBytes(state.downloaded), formatBytes(state.total)) : '');
			message.style.color = state.state === 'error' || !supported ? '#c33' : '';
		}).catch(function(err) {
			dom.content(message, _('Unable to read download status: %s').format(err.message || err));
		});
	}

	function field(label, widget, hint) {
		return E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, [ label ]),
			E('div', { 'class': 'cbi-value-field' }, [
				widget,
				hint ? E('div', { 'class': 'cbi-value-description' }, [ hint ]) : ''
			])
		]);
	}

	poll.add(update, 2);
	update();
	return E('div', { 'class': 'cbi-section' }, [
		field(_('Installed version'), installed),
		field(_('Architecture'), E('span', {}, [ info.architecture || _('Unknown') ])),
		field(_('Version to download'), version, _('Use latest for the latest published backend, or enter a specific version.')),
		field(_('Program directory'), directory.render(), _('Use an external disk with execution support. Program files are stored separately from the database and media.')),
		field(_('Download source'), mirror.render(), _('An accelerator URL is prepended to the GitHub download URL. Custom HTTPS addresses are supported.')),
		E('div', { 'style': 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px' }, [ downloadButton, cancelButton ]),
		message, progress, details
	]);
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callInfo(), {}),
			uci.load('tingreader')
		]);
	},

	render: function(data) {
		var info = data[0] || {};
		var mounts = L.toArray(info.mounts);
		var defaultDataDir = mounts.length ? mounts[0].path.replace(/\/$/, '') + '/tingreader' : '/etc/tingreader';
		var m, s, o;

		var desc = _('Ting Reader is a self-hosted audiobook server and management tool. Default administrator login username: admin, password: admin123.');
		var headerNodes = [
			E('p', { 'style': 'margin-bottom:6px;' }, [
				desc,
				' ',
				E('a', {
					'href': 'https://github.com/dqsq2e2/ting-reader',
					'target': '_blank',
					'rel': 'noreferrer noopener',
					'style': 'color:#1976d2;font-weight:bold;'
				}, [ _('GitHub') ]),
				' | ',
				E('a', {
					'href': 'https://github.com/dqsq2e2/luci-app-tingreader',
					'target': '_blank',
					'rel': 'noreferrer noopener',
					'style': 'color:#1976d2;font-weight:bold;'
				}, [ _('LuCI App') ])
			])
		];

		m = new form.Map('tingreader');

		s = m.section(form.NamedSection, 'main', 'tingreader', _('Settings'));
		s.addremove = false;
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.rmempty = false;

		o = s.option(form.Value, 'listen_addr', _('Listen address'));
		o.default = '0.0.0.0';
		o.placeholder = '0.0.0.0';
		o.datatype = 'ipaddr';
		o.rmempty = false;

		o = s.option(form.Value, 'listen_port', _('Listen port'));
		o.default = '3000';
		o.placeholder = '3000';
		o.datatype = 'port';
		o.rmempty = false;

		o = s.option(form.Value, 'data_dir', _('Database and data directory'),
			_('Changing this path creates a new instance; to keep your data, stop Ting Reader first and then move the existing data.'));
		o.default = defaultDataDir;
		o.placeholder = defaultDataDir;
		o.validate = validatePath;
		o.rmempty = false;

		var seenDataDirs = {};
		var dataDirMounts = mounts.length ? mounts : [
			{ path: '/etc', total: 0, free: 0, type: 'overlay' }
		];

		dataDirMounts.forEach(function(mount) {
			var mountPath = String(mount.path || '').replace(/\/+$/, '');
			if (!mountPath)
				return;

			var path = mountPath + '/tingreader';
			if (seenDataDirs[path])
				return;
			seenDataDirs[path] = true;

			var details = mount.total
				? _('%s total, %s free (%s)').format(formatBytes(mount.total), formatBytes(mount.free), mount.type || '')
				: '';
			var labelNodes = [
				E('strong', { 'style': 'display:block;' }, [ path ])
			];

			if (details)
				labelNodes.push(E('small', { 'class': 'hide-close', 'style': 'color:#888;' }, [ details ]));

			var label = E('div', { 'style': 'line-height:1.35;' }, labelNodes);

			o.value(path, label);
		});

		// Use LuCI's native dropdown so detected choices and custom input share
		// one widget and the selected value is parsed by form.Map correctly.
		o.renderWidget = function(section_id, option_index, cfgvalue) {
			var value = (cfgvalue != null) ? cfgvalue : this.default;
			var widget = new ui.Dropdown(value, this.transformChoices(), {
				id: this.cbid(section_id),
				sort: this.keylist,
				optional: false,
				create: true,
				datatype: this.datatype,
				select_placeholder: this.placeholder,
				custom_placeholder: _('Enter a custom absolute path'),
				validate: this.getValidator(section_id),
				disabled: (this.readonly != null) ? this.readonly : this.map.readonly
			});

			return widget.render();
		};

		o = s.option(form.ListValue, 'log_level', _('Log level'));
		o.default = 'info';
		o.value('debug', _('Debug'));
		o.value('info', _('Info'));
		o.value('warn', _('Warning'));
		o.value('error', _('Error'));

		s = m.section(form.GridSection, 'repository', _('Local Repository Authorized Paths'),
			_('Configure local repository authorized paths. If none is configured on first start, the system automatically creates a default authorized path under the data directory.'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add local repository authorized path');
		s.modaltitle = function(section_id) {
			return section_id ? _('Edit local repository authorized path') : _('Add local repository authorized path');
		};

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '1';
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.placeholder = _('e.g. Audiobooks');
		o.editable = true;

		o = s.option(form.Value, 'path', _('Path'));
		o.validate = validatePath;
		o.editable = true;

		return m.render().then(function(mapNode) {
			var tabs = E('div', {}, [
				E('div', {
					'data-tab': 'configuration',
					'data-tab-title': _('Configuration')
				}, [ mapNode ]),
				E('div', {
					'data-tab': 'program',
					'data-tab-title': _('Program management')
				}, [ renderDownloadSection(info, defaultDataDir, mounts) ])
			]);
			var page = E('div', {}, [
				E('h2', {}, [ _('Ting Reader') ]),
				E('div', { 'class': 'cbi-map-descr' }, headerNodes),
				renderStatusSection(),
				tabs
			]);

			ui.tabs.initTabGroup(tabs.childNodes);
			return page;
		});
	}
});
