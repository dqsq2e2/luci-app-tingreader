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

var statusNode;

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
		details.push(_('MEM %s').format(withPercent(status.memory)));

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

		if (info.version) {
			headerNodes.push(E('p', { 'style': 'margin:0;color:#666;' }, [
				_('Installed version: %s').format(info.version)
			]));
		}

		m = new form.Map('tingreader', _('Ting Reader'), E('div', { 'class': 'cbi-map-descr' }, headerNodes));

		s = m.section(form.TypedSection);
		s.anonymous = true;
		s.render = renderStatusSection;

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
			_('Changing this path creates a new instance; to keep your data, stop Ting Reader first and then move the existing data. You can directly edit this path or click the arrow to select an auto-detected disk.'));
		o.default = defaultDataDir;
		o.placeholder = defaultDataDir;
		o.validate = validatePath;
		o.rmempty = false;

		o.renderWidget = function(section_id, option_index, cfgvalue) {
			var value = (cfgvalue != null) ? cfgvalue : this.default;

			var widget = new ui.Textfield(value, {
				id: this.cbid(section_id),
				placeholder: this.placeholder,
				validate: this.getValidator(section_id),
				disabled: (this.readonly != null) ? this.readonly : this.map.readonly
			});

			var inputEl = widget.render();
			inputEl.style.width = '100%';
			inputEl.style.paddingRight = '32px';
			inputEl.style.boxSizing = 'border-box';

			var menu = E('ul', {
				'class': 'cbi-dropdown-menu',
				'style': 'display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:9999;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 6px 16px rgba(0,0,0,0.18);list-style:none;margin:0;padding:4px 0;max-height:220px;overflow-y:auto;'
			});

			function toggleMenu(show) {
				if (show === undefined)
					show = menu.style.display === 'none';
				menu.style.display = show ? 'block' : 'none';
			}

			var items = mounts.slice();
			if (!items.length) {
				items.push({ path: '/etc/tingreader', total: 0, free: 0, type: 'overlay' });
			}

			items.forEach(function(mount) {
				var path = mount.path.replace(/\/$/, '') + '/tingreader';
				var itemEl = E('li', {
					'style': 'padding:8px 12px;cursor:pointer;font-size:13px;line-height:1.4;border-bottom:1px solid #f0f0f0;transition:background 0.2s;'
				}, [
					E('div', { 'style': 'font-weight:bold;color:#333;' }, [ path ]),
					mount.total ? E('div', { 'style': 'font-size:11px;color:#888;' }, [
						_('%s total, %s free (%s)').format(formatBytes(mount.total), formatBytes(mount.free), mount.type || '')
					]) : ''
				]);

				itemEl.addEventListener('mouseenter', function() {
					itemEl.style.background = 'rgba(0,122,255,0.1)';
				});
				itemEl.addEventListener('mouseleave', function() {
					itemEl.style.background = '';
				});

				itemEl.addEventListener('mousedown', function(ev) {
					ev.preventDefault();
					inputEl.value = path;
					inputEl.dispatchEvent(new Event('input', { bubbles: true }));
					inputEl.dispatchEvent(new Event('change', { bubbles: true }));
					toggleMenu(false);
				});

				menu.appendChild(itemEl);
			});

			var arrowBtn = E('button', {
				'type': 'button',
				'style': 'position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px 6px;color:#888;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;z-index:2;',
				'title': _('Select from detected storage')
			}, [ '▼' ]);

			arrowBtn.addEventListener('click', function(ev) {
				ev.preventDefault();
				ev.stopPropagation();
				toggleMenu();
			});

			var container = E('div', {
				'class': 'control-group',
				'style': 'position:relative;display:inline-block;width:100%;max-width:460px;vertical-align:middle;'
			}, [
				inputEl,
				arrowBtn,
				menu
			]);

			document.addEventListener('click', function(ev) {
				if (!container.contains(ev.target))
					toggleMenu(false);
			});

			return container;
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

		return m.render();
	}
});
