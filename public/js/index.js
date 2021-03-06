/* jquery and jquery plugins */
require('../vendor/showup/showup');

require('prismjs/themes/prism.css');
require('highlight.js/styles/github-gist.css');

require('prismjs');
require('prismjs/components/prism-wiki');
var toMarkdown = require('to-markdown');

var saveAs = require('file-saver').saveAs;
require('js-url');
require('randomcolor');

var _ = require("lodash");

var List = require('list.js');

var common = require('./common.js');
var urlpath = common.urlpath;
var noteid = common.noteid;
var debug = common.debug;
var version = common.version;
var GOOGLE_API_KEY = common.GOOGLE_API_KEY;
var GOOGLE_CLIENT_ID = common.GOOGLE_CLIENT_ID;
var DROPBOX_APP_KEY = common.DROPBOX_APP_KEY;
var noteurl = common.noteurl;

var checkLoginStateChanged = common.checkLoginStateChanged;

require('./pretty');
var extra = require('./extra');
var md = extra.md;
var updateLastChange = extra.updateLastChange;
var postProcess = extra.postProcess;
var finishView = extra.finishView;
var autoLinkify = extra.autoLinkify;
var generateToc = extra.generateToc;
var smoothHashScroll = extra.smoothHashScroll;
var deduplicatedHeaderId = extra.deduplicatedHeaderId;
var renderTOC = extra.renderTOC;
var renderTitle = extra.renderTitle;
var renderFilename = extra.renderFilename;
var scrollToHash = extra.scrollToHash;
var updateLastChangeUser = extra.updateLastChangeUser;
var updateOwner = extra.updateOwner;
var parseMeta = extra.parseMeta;
var exportToHTML = extra.exportToHTML;
var exportToRawHTML = extra.exportToRawHTML;

var syncScroll = require('./syncscroll');
var setupSyncAreas = syncScroll.setupSyncAreas;
var clearMap = syncScroll.clearMap;
var syncScrollToEdit = syncScroll.syncScrollToEdit;
var syncScrollToView = syncScroll.syncScrollToView;

var historyModule = require('./history');
var writeHistory = historyModule.writeHistory;
var deleteServerHistory = historyModule.deleteServerHistory;
var getHistory = historyModule.getHistory;
var saveHistory = historyModule.saveHistory;
var removeHistory = historyModule.removeHistory;

var renderer = require('./render');
var preventXSS = renderer.preventXSS;

var defaultTextHeight = 20;
var viewportMargin = 20;
var mac = CodeMirror.keyMap["default"] == CodeMirror.keyMap.macDefault;
var defaultEditorMode = 'gfm';
var defaultExtraKeys = {
    "F10": function (cm) {
        cm.setOption("fullScreen", !cm.getOption("fullScreen"));
    },
    "Esc": function (cm) {
        if (cm.getOption('keyMap').substr(0, 3) === 'vim') return CodeMirror.Pass;
        else if (cm.getOption("fullScreen")) cm.setOption("fullScreen", false);
    },
    "Cmd-S": function () {
        return false;
    },
    "Ctrl-S": function () {
        return false;
    },
    "Enter": "newlineAndIndentContinueMarkdownList",
    "Tab": function (cm) {
        var tab = '\t';
        var spaces = Array(parseInt(cm.getOption("indentUnit")) + 1).join(" ");
        //auto indent whole line when in list or blockquote
        var cursor = cm.getCursor();
        var line = cm.getLine(cursor.line);
        var regex = /^(\s*)(>[> ]*|[*+-]\s|(\d+)([.)]))/;
        var match;
        var multiple = cm.getSelection().split('\n').length > 1 || cm.getSelections().length > 1;
        if (multiple) {
            cm.execCommand('defaultTab');
        } else if ((match = regex.exec(line)) !== null) {
            var ch = match[1].length;
            var pos = {
                line: cursor.line,
                ch: ch
            };
            if (cm.getOption('indentWithTabs'))
                cm.replaceRange(tab, pos, pos, '+input');
            else
                cm.replaceRange(spaces, pos, pos, '+input');
        } else {
            if (cm.getOption('indentWithTabs'))
                cm.execCommand('defaultTab');
            else {
                cm.replaceSelection(spaces);
            }
        }
    },
    "Cmd-Left": "goLineLeftSmart",
    "Cmd-Right": "goLineRight",
    "Ctrl-C": function (cm) {
        if (!mac && cm.getOption('keyMap').substr(0, 3) === 'vim') document.execCommand("copy");
        else return CodeMirror.Pass;
    },
    "Ctrl-*": function (cm) {
        wrapTextWith(cm, '*');
    },
    "Shift-Ctrl-8": function (cm) {
        wrapTextWith(cm, '*');
    },
    "Ctrl-_": function (cm) {
        wrapTextWith(cm, '_');
    },
    "Shift-Ctrl--": function (cm) {
        wrapTextWith(cm, '_');
    },
    "Ctrl-~": function (cm) {
        wrapTextWith(cm, '~');
    },
    "Shift-Ctrl-`": function (cm) {
        wrapTextWith(cm, '~');
    },
    "Ctrl-^": function (cm) {
        wrapTextWith(cm, '^');
    },
    "Shift-Ctrl-6": function (cm) {
        wrapTextWith(cm, '^');
    },
    "Ctrl-+": function (cm) {
        wrapTextWith(cm, '+');
    },
    "Shift-Ctrl-=": function (cm) {
        wrapTextWith(cm, '+');
    },
    "Ctrl-=": function (cm) {
        wrapTextWith(cm, '=');
    },
    "Shift-Ctrl-Backspace": function (cm) {
        wrapTextWith(cm, 'Backspace');
    }
};

var wrapSymbols = ['*', '_', '~', '^', '+', '='];

function wrapTextWith(cm, symbol) {
    if (!cm.getSelection()) {
        return CodeMirror.Pass;
    } else {
        var ranges = cm.listSelections();
        for (var i = 0; i < ranges.length; i++) {
            var range = ranges[i];
            if (!range.empty()) {
                var from = range.from(), to = range.to();
                if (symbol !== 'Backspace') {
                    cm.replaceRange(symbol, to, to, '+input');
                    cm.replaceRange(symbol, from, from, '+input');
                    // workaround selection range not correct after add symbol
                    var _ranges = cm.listSelections();
                    var anchorIndex = editor.indexFromPos(_ranges[i].anchor);
                    var headIndex = editor.indexFromPos(_ranges[i].head);
                    if (anchorIndex > headIndex) {
                        _ranges[i].anchor.ch--;
                    } else {
                        _ranges[i].head.ch--;
                    }
                    cm.setSelections(_ranges);
                } else {
                    var preEndPos = {
                        line: to.line,
                        ch: to.ch + 1
                    };
                    var preText = cm.getRange(to, preEndPos);
                    var preIndex = wrapSymbols.indexOf(preText);
                    var postEndPos = {
                        line: from.line,
                        ch: from.ch - 1
                    };
                    var postText = cm.getRange(postEndPos, from);
                    var postIndex = wrapSymbols.indexOf(postText);
                    // check if surround symbol are list in array and matched
                    if (preIndex > -1 && postIndex > -1 && preIndex === postIndex) {
                        cm.replaceRange("", to, preEndPos, '+delete');
                        cm.replaceRange("", postEndPos, from, '+delete');
                    }
                }
            }
        }
    }
}

var idleTime = 300000; //5 mins
var updateViewDebounce = 100;
var cursorMenuThrottle = 50;
var cursorActivityDebounce = 50;
var cursorAnimatePeriod = 100;
var supportContainers = ['success', 'info', 'warning', 'danger'];
var supportCodeModes = ['javascript', 'htmlmixed', 'htmlembedded', 'css', 'xml', 'clike', 'clojure', 'ruby', 'python', 'shell', 'php', 'sql', 'coffeescript', 'yaml', 'pug', 'lua', 'cmake', 'nginx', 'perl', 'sass', 'r', 'dockerfile', 'tiddlywiki', 'mediawiki'];
var supportCharts = ['sequence', 'flow', 'graphviz', 'mermaid'];
var supportHeaders = [
    {
        text: '# h1',
        search: '#'
    },
    {
        text: '## h2',
        search: '##'
    },
    {
        text: '### h3',
        search: '###'
    },
    {
        text: '#### h4',
        search: '####'
    },
    {
        text: '##### h5',
        search: '#####'
    },
    {
        text: '###### h6',
        search: '######'
    },
    {
        text: '###### tags: `example`',
        search: '###### tags:'
    }
];
var supportReferrals = [
    {
        text: '[reference link]',
        search: '[]'
    },
    {
        text: '[reference]: https:// "title"',
        search: '[]:'
    },
    {
        text: '[^footnote link]',
        search: '[^]'
    },
    {
        text: '[^footnote reference]: https:// "title"',
        search: '[^]:'
    },
    {
        text: '^[inline footnote]',
        search: '^[]'
    },
    {
        text: '[link text][reference]',
        search: '[][]'
    },
    {
        text: '[link text](https:// "title")',
        search: '[]()'
    },
    {
        text: '![image alt][reference]',
        search: '![][]'
    },
    {
        text: '![image alt](https:// "title")',
        search: '![]()'
    },
    {
        text: '![image alt](https:// "title" =WidthxHeight)',
        search: '![]()'
    },
    {
        text: '[TOC]',
        search: '[]'
    }
];
var supportExternals = [
    {
        text: '{%youtube youtubeid %}',
        search: 'youtube'
    },
    {
        text: '{%vimeo vimeoid %}',
        search: 'vimeo'
    },
    {
        text: '{%gist gistid %}',
        search: 'gist'
    },
    {
        text: '{%slideshare slideshareid %}',
        search: 'slideshare'
    },
    {
        text: '{%speakerdeck speakerdeckid %}',
        search: 'speakerdeck'
    },
    {
        text: '{%pdf pdfurl %}',
        search: 'pdf'
    }
];
var supportExtraTags = [
    {
        text: '[name tag]',
        search: '[]',
        command: function () {
            return '[name=' + personalInfo.name + ']';
        },
    },
    {
        text: '[time tag]',
        search: '[]',
        command: function () {
            return '[time=' + moment().format('llll') + ']';
        },
    },
    {
        text: '[my color tag]',
        search: '[]',
        command: function () {
            return '[color=' + personalInfo.color + ']';
        }
    },
    {
        text: '[random color tag]',
        search: '[]',
        command: function () {
            var color = randomColor();
            return '[color=' + color + ']';
        }
    }
];
window.modeType = {
    edit: {
        name: "edit"
    },
    view: {
        name: "view"
    },
    both: {
        name: "both"
    }
};
var statusType = {
    connected: {
        msg: "CONNECTED",
        label: "label-warning",
        fa: "fa-wifi"
    },
    online: {
        msg: "ONLINE",
        label: "label-primary",
        fa: "fa-users"
    },
    offline: {
        msg: "OFFLINE",
        label: "label-danger",
        fa: "fa-plug"
    }
};
var defaultMode = modeType.view;

//global vars
window.loaded = false;
window.needRefresh = false;
window.isDirty = false;
window.editShown = false;
window.visibleXS = false;
window.visibleSM = false;
window.visibleMD = false;
window.visibleLG = false;
window.isTouchDevice = 'ontouchstart' in document.documentElement;
window.currentMode = defaultMode;
window.currentStatus = statusType.offline;
window.lastInfo = {
    needRestore: false,
    cursor: null,
    scroll: null,
    edit: {
        scroll: {
            left: null,
            top: null
        },
        cursor: {
            line: null,
            ch: null
        }
    },
    view: {
        scroll: {
            left: null,
            top: null
        }
    },
    history: null
};
window.personalInfo = {};
window.onlineUsers = [];
window.fileTypes = {
    "pl": "perl",
    "cgi": "perl",
    "js": "javascript",
    "php": "php",
    "sh": "bash",
    "rb": "ruby",
    "html": "html",
    "py": "python"
};

//editor settings
var textit = document.getElementById("textit");
if (!textit) throw new Error("There was no textit area!");
window.editor = CodeMirror.fromTextArea(textit, {
    mode: defaultEditorMode,
    backdrop: defaultEditorMode,
    keyMap: "sublime",
    viewportMargin: viewportMargin,
    styleActiveLine: true,
    lineNumbers: true,
    lineWrapping: true,
    showCursorWhenSelecting: true,
    highlightSelectionMatches: true,
    indentUnit: 4,
    continueComments: "Enter",
    theme: "one-dark",
    inputStyle: "textarea",
    matchBrackets: true,
    autoCloseBrackets: true,
    matchTags: {
        bothTags: true
    },
    autoCloseTags: true,
    foldGutter: true,
    gutters: ["CodeMirror-linenumbers", "authorship-gutters", "CodeMirror-foldgutter"],
    extraKeys: defaultExtraKeys,
    flattenSpans: true,
    addModeClass: true,
    readOnly: true,
    autoRefresh: true,
    placeholder: "← Start by entering a title here\n===\nVisit /features if you don't know what to do.\nHappy hacking :)"
});
var inlineAttach = inlineAttachment.editors.codemirror4.attach(editor);
defaultTextHeight = parseInt($(".CodeMirror").css('line-height'));

var statusBarTemplate = null;
var statusBar = null;
var statusPanel = null;
var statusCursor = null;
var statusFile = null;
var statusIndicators = null;
var statusLength = null;
var statusKeymap = null;
var statusIndent = null;
var statusTheme = null;
var statusSpellcheck = null;

function getStatusBarTemplate(callback) {
    $.get(serverurl + '/views/statusbar.html', function (template) {
        statusBarTemplate = template;
        if (callback) callback();
    });
}
getStatusBarTemplate();

function addStatusBar() {
    if (!statusBarTemplate) {
        getStatusBarTemplate(addStatusBar);
        return;
    }
    statusBar = $(statusBarTemplate);
    statusCursor = statusBar.find('.status-cursor');
    statusFile = statusBar.find('.status-file');
    statusIndicators = statusBar.find('.status-indicators');
    statusIndent = statusBar.find('.status-indent');
    statusKeymap = statusBar.find('.status-keymap');
    statusLength = statusBar.find('.status-length');
    statusTheme = statusBar.find('.status-theme');
    statusSpellcheck = statusBar.find('.status-spellcheck');
    statusPanel = editor.addPanel(statusBar[0], {
        position: "bottom"
    });

    setIndent();
    setKeymap();
    setTheme();
    setSpellcheck();
}

function setIndent() {
    var cookieIndentType = Cookies.get('indent_type');
    var cookieTabSize = parseInt(Cookies.get('tab_size'));
    var cookieSpaceUnits = parseInt(Cookies.get('space_units'));
    if (cookieIndentType) {
        if (cookieIndentType == 'tab') {
            editor.setOption('indentWithTabs', true);
            if (cookieTabSize)
                editor.setOption('indentUnit', cookieTabSize);
        } else if (cookieIndentType == 'space') {
            editor.setOption('indentWithTabs', false);
            if (cookieSpaceUnits)
                editor.setOption('indentUnit', cookieSpaceUnits);
        }
    }
    if (cookieTabSize)
        editor.setOption('tabSize', cookieTabSize);

    var type = statusIndicators.find('.indent-type');
    var widthLabel = statusIndicators.find('.indent-width-label');
    var widthInput = statusIndicators.find('.indent-width-input');

    function setType() {
        if (editor.getOption('indentWithTabs')) {
            Cookies.set('indent_type', 'tab', {
                expires: 365
            });
            type.text('Tab Size:');
        } else {
            Cookies.set('indent_type', 'space', {
                expires: 365
            });
            type.text('Spaces:');
        }
    }
    setType();

    function setUnit() {
        var unit = editor.getOption('indentUnit');
        if (editor.getOption('indentWithTabs')) {
            Cookies.set('tab_size', unit, {
                expires: 365
            });
        } else {
            Cookies.set('space_units', unit, {
                expires: 365
            });
        }
        widthLabel.text(unit);
    }
    setUnit();

    type.click(function () {
        if (editor.getOption('indentWithTabs')) {
            editor.setOption('indentWithTabs', false);
            cookieSpaceUnits = parseInt(Cookies.get('space_units'));
            if (cookieSpaceUnits)
                editor.setOption('indentUnit', cookieSpaceUnits)
        } else {
            editor.setOption('indentWithTabs', true);
            cookieTabSize = parseInt(Cookies.get('tab_size'));
            if (cookieTabSize) {
                editor.setOption('indentUnit', cookieTabSize);
                editor.setOption('tabSize', cookieTabSize);
            }
        }
        setType();
        setUnit();
    });
    widthLabel.click(function () {
        if (widthLabel.is(':visible')) {
            widthLabel.addClass('hidden');
            widthInput.removeClass('hidden');
            widthInput.val(editor.getOption('indentUnit'));
            widthInput.select();
        } else {
            widthLabel.removeClass('hidden');
            widthInput.addClass('hidden');
        }
    });
    widthInput.on('change', function () {
        var val = parseInt(widthInput.val());
        if (!val) val = editor.getOption('indentUnit');
        if (val < 1) val = 1;
        else if (val > 10) val = 10;

        if (editor.getOption('indentWithTabs')) {
            editor.setOption('tabSize', val);
        }
        editor.setOption('indentUnit', val);
        setUnit();
    });
    widthInput.on('blur', function () {
        widthLabel.removeClass('hidden');
        widthInput.addClass('hidden');
    });
}

function setKeymap() {
    var cookieKeymap = Cookies.get('keymap');
    if (cookieKeymap)
        editor.setOption('keyMap', cookieKeymap);

    var label = statusIndicators.find('.ui-keymap-label');
    var sublime = statusIndicators.find('.ui-keymap-sublime');
    var emacs = statusIndicators.find('.ui-keymap-emacs');
    var vim = statusIndicators.find('.ui-keymap-vim');

    function setKeymapLabel() {
        var keymap = editor.getOption('keyMap');
        Cookies.set('keymap', keymap, {
            expires: 365
        });
        label.text(keymap);
    }
    setKeymapLabel();

    sublime.click(function () {
        editor.setOption('keyMap', 'sublime');
        setKeymapLabel();
    });
    emacs.click(function () {
        editor.setOption('keyMap', 'emacs');
        setKeymapLabel();
    });
    vim.click(function () {
        editor.setOption('keyMap', 'vim');
        setKeymapLabel();
    });
}

function setTheme() {
    var cookieTheme = Cookies.get('theme');
    if (cookieTheme) {
        editor.setOption('theme', cookieTheme);
    }

    var themeToggle = statusTheme.find('.ui-theme-toggle');
    themeToggle.click(function () {
        var theme = editor.getOption('theme');
        if (theme == "one-dark") {
            theme = "default";
        } else {
            theme = "one-dark";
        }
        editor.setOption('theme', theme);
        Cookies.set('theme', theme, {
            expires: 365
        });
        checkTheme();
    });
    function checkTheme() {
        var theme = editor.getOption('theme');
        if (theme == "one-dark") {
            themeToggle.removeClass('active');
        } else {
            themeToggle.addClass('active');
        }
    }
    checkTheme();
}

function setSpellcheck() {
    var cookieSpellcheck = Cookies.get('spellcheck');
    if (cookieSpellcheck) {
        var mode = null;
        if (cookieSpellcheck === 'true' || cookieSpellcheck === true) {
            mode = 'spell-checker';
        } else {
            mode = defaultEditorMode;
        }
        if (mode && mode !== editor.getOption('mode')) {
            editor.setOption('mode', mode);
        }
    }

    var spellcheckToggle = statusSpellcheck.find('.ui-spellcheck-toggle');
    spellcheckToggle.click(function () {
        var mode = editor.getOption('mode');
        if (mode == defaultEditorMode) {
            mode = "spell-checker";
        } else {
            mode = defaultEditorMode;
        }
        if (mode && mode !== editor.getOption('mode')) {
            editor.setOption('mode', mode);
        }
        Cookies.set('spellcheck', (mode == "spell-checker"), {
            expires: 365
        });
        checkSpellcheck();
    });
    function checkSpellcheck() {
        var mode = editor.getOption('mode');
        if (mode == defaultEditorMode) {
            spellcheckToggle.removeClass('active');
        } else {
            spellcheckToggle.addClass('active');
        }
    }
    checkSpellcheck();

    //workaround spellcheck might not activate beacuse the ajax loading
    if (num_loaded < 2) {
        var spellcheckTimer = setInterval(function () {
            if (num_loaded >= 2) {
                if (editor.getOption('mode') == "spell-checker")
                    editor.setOption('mode', "spell-checker");
                clearInterval(spellcheckTimer);
            }
        }, 100);
    }
}

var selection = null;

function updateStatusBar() {
    if (!statusBar) return;
    var cursor = editor.getCursor();
    var cursorText = 'Line ' + (cursor.line + 1) + ', Columns ' + (cursor.ch + 1);
    if (selection) {
        var anchor = selection.anchor;
        var head = selection.head;
        var start = head.line <= anchor.line ? head : anchor;
        var end = head.line >= anchor.line ? head : anchor;
        var selectionText = ' — Selected ';
        var selectionCharCount = Math.abs(head.ch - anchor.ch);
        // borrow from brackets EditorStatusBar.js
        if (start.line !== end.line) {
            var lines = end.line - start.line + 1;
            if (end.ch === 0) {
                lines--;
            }
            selectionText += lines + ' lines';
        } else if (selectionCharCount > 0)
            selectionText += selectionCharCount + ' columns';
        if (start.line !== end.line || selectionCharCount > 0)
            cursorText += selectionText;
    }
    statusCursor.text(cursorText);
    var fileText = ' — ' + editor.lineCount() + ' Lines';
    statusFile.text(fileText);
    var docLength = editor.getValue().length;
    statusLength.text('Length ' + docLength);
    if (docLength > (docmaxlength * 0.95)) {
        statusLength.css('color', 'red');
        statusLength.attr('title', 'Your almost reach note max length limit.');
    } else if (docLength > (docmaxlength * 0.8)) {
        statusLength.css('color', 'orange');
        statusLength.attr('title', 'You nearly fill the note, consider to make more pieces.');
    } else {
        statusLength.css('color', 'white');
        statusLength.attr('title', 'You could write up to ' + docmaxlength + ' characters in this note.');
    }
}

//ui vars
window.ui = {
    spinner: $(".ui-spinner"),
    content: $(".ui-content"),
    toolbar: {
        shortStatus: $(".ui-short-status"),
        status: $(".ui-status"),
        new: $(".ui-new"),
        publish: $(".ui-publish"),
        extra: {
            revision: $(".ui-extra-revision"),
            slide: $(".ui-extra-slide")
        },
        download: {
            markdown: $(".ui-download-markdown"),
            html: $(".ui-download-html"),
            rawhtml: $(".ui-download-raw-html"),
            pdf: $(".ui-download-pdf-beta"),
        },
        export: {
            dropbox: $(".ui-save-dropbox"),
            googleDrive: $(".ui-save-google-drive"),
            gist: $(".ui-save-gist"),
            snippet: $(".ui-save-snippet")
        },
        import: {
            dropbox: $(".ui-import-dropbox"),
            googleDrive: $(".ui-import-google-drive"),
            gist: $(".ui-import-gist"),
            snippet: $(".ui-import-snippet"),
            clipboard: $(".ui-import-clipboard")
        },
        mode: $(".ui-mode"),
        edit: $(".ui-edit"),
        view: $(".ui-view"),
        both: $(".ui-both"),
        uploadImage: $(".ui-upload-image")
    },
    infobar: {
        lastchange: $(".ui-lastchange"),
        lastchangeuser: $(".ui-lastchangeuser"),
        nolastchangeuser: $(".ui-no-lastchangeuser"),
        permission: {
            permission: $(".ui-permission"),
            label: $(".ui-permission-label"),
            freely: $(".ui-permission-freely"),
            editable: $(".ui-permission-editable"),
            locked: $(".ui-permission-locked"),
            private: $(".ui-permission-private")
        },
        delete: $(".ui-delete-note")
    },
    toc: {
        toc: $('.ui-toc'),
        affix: $('.ui-affix-toc'),
        label: $('.ui-toc-label'),
        dropdown: $('.ui-toc-dropdown')
    },
    area: {
        edit: $(".ui-edit-area"),
        view: $(".ui-view-area"),
        codemirror: $(".ui-edit-area .CodeMirror"),
        codemirrorScroll: $(".ui-edit-area .CodeMirror .CodeMirror-scroll"),
        codemirrorSizer: $(".ui-edit-area .CodeMirror .CodeMirror-sizer"),
        codemirrorSizerInner: $(".ui-edit-area .CodeMirror .CodeMirror-sizer > div"),
        markdown: $(".ui-view-area .markdown-body"),
        resize: {
            handle: $('.ui-resizable-handle'),
            syncToggle: $('.ui-sync-toggle')
        }
    },
    modal: {
        snippetImportProjects: $("#snippetImportModalProjects"),
        snippetImportSnippets: $("#snippetImportModalSnippets"),
        revision: $("#revisionModal")
    }
};

//page actions
var opts = {
    lines: 11, // The number of lines to draw
    length: 20, // The length of each line
    width: 2, // The line thickness
    radius: 30, // The radius of the inner circle
    corners: 0, // Corner roundness (0..1)
    rotate: 0, // The rotation offset
    direction: 1, // 1: clockwise, -1: counterclockwise
    color: '#000', // #rgb or #rrggbb or array of colors
    speed: 1.1, // Rounds per second
    trail: 60, // Afterglow percentage
    shadow: false, // Whether to render a shadow
    hwaccel: true, // Whether to use hardware acceleration
    className: 'spinner', // The CSS class to assign to the spinner
    zIndex: 2e9, // The z-index (defaults to 2000000000)
    top: '50%', // Top position relative to parent
    left: '50%' // Left position relative to parent
};
var spinner = new Spinner(opts).spin(ui.spinner[0]);

//idle
var idle = new Idle({
    onAway: function () {
        idle.isAway = true;
        emitUserStatus();
        updateOnlineStatus();
    },
    onAwayBack: function () {
        idle.isAway = false;
        emitUserStatus();
        updateOnlineStatus();
        setHaveUnreadChanges(false);
        updateTitleReminder();
    },
    awayTimeout: idleTime
});
ui.area.codemirror.on('touchstart', function () {
    idle.onActive();
});

var haveUnreadChanges = false;

function setHaveUnreadChanges(bool) {
    if (!loaded) return;
    if (bool && (idle.isAway || Visibility.hidden())) {
        haveUnreadChanges = true;
    } else if (!bool && !idle.isAway && !Visibility.hidden()) {
        haveUnreadChanges = false;
    }
}

function updateTitleReminder() {
    if (!loaded) return;
    if (haveUnreadChanges) {
        document.title = '• ' + renderTitle(ui.area.markdown);
    } else {
        document.title = renderTitle(ui.area.markdown);
    }
}

function setRefreshModal(status) {
    $('#refreshModal').modal('show');
    $('#refreshModal').find('.modal-body > div').hide();
    $('#refreshModal').find('.' + status).show();
}

function setNeedRefresh() {
    needRefresh = true;
    editor.setOption('readOnly', true);
    socket.disconnect();
    showStatus(statusType.offline);
}

loginStateChangeEvent = function () {
    setRefreshModal('user-state-changed');
    setNeedRefresh();
};

//visibility
var wasFocus = false;
Visibility.change(function (e, state) {
    var hidden = Visibility.hidden();
    if (hidden) {
        if (editorHasFocus()) {
            wasFocus = true;
            editor.getInputField().blur();
        }
    } else {
        if (wasFocus) {
            if (!visibleXS) {
                editor.focus();
                editor.refresh();
            }
            wasFocus = false;
        }
        setHaveUnreadChanges(false);
    }
    updateTitleReminder();
});

//when page ready
$(document).ready(function () {
    idle.checkAway();
    checkResponsive();
    //if in smaller screen, we don't need advanced scrollbar
    var scrollbarStyle;
    if (visibleXS) {
        scrollbarStyle = 'native';
    } else {
        scrollbarStyle = 'overlay';
    }
    if (scrollbarStyle != editor.getOption('scrollbarStyle')) {
        editor.setOption('scrollbarStyle', scrollbarStyle);
        clearMap();
    }
    checkEditorStyle();
    /* we need this only on touch devices */
    if (isTouchDevice) {
        /* cache dom references */
        var $body = jQuery('body');

        /* bind events */
        $(document)
            .on('focus', 'textarea, input', function () {
                $body.addClass('fixfixed');
            })
            .on('blur', 'textarea, input', function () {
                $body.removeClass('fixfixed');
            });
    }
    //showup
    $().showUp('.navbar', {
        upClass: 'navbar-hide',
        downClass: 'navbar-show'
    });
    //tooltip
    $('[data-toggle="tooltip"]').tooltip();
    // shortcuts
    // allow on all tags
    key.filter = function (e) { return true; };
    key('ctrl+alt+e', function (e) {
        changeMode(modeType.edit);
    });
    key('ctrl+alt+v', function (e) {
        changeMode(modeType.view);
    });
    key('ctrl+alt+b', function (e) {
        changeMode(modeType.both);
    });
});
//when page resize
$(window).resize(function () {
    checkLayout();
    checkEditorStyle();
    checkTocStyle();
    checkCursorMenu();
    windowResize();
});
//when page unload
$(window).on('unload', function () {
    //updateHistoryInner();
});
$(window).on('error', function () {
    //setNeedRefresh();
});

setupSyncAreas(ui.area.codemirrorScroll, ui.area.view, ui.area.markdown);

function autoSyncscroll() {
    if (editorHasFocus()) {
        syncScrollToView();
    } else {
        syncScrollToEdit();
    }
}

var windowResizeDebounce = 200;
var windowResize = _.debounce(windowResizeInner, windowResizeDebounce);

function windowResizeInner(callback) {
    checkLayout();
    checkResponsive();
    checkEditorStyle();
    checkTocStyle();
    checkCursorMenu();
    //refresh editor
    if (loaded) {
        if (editor.getOption('scrollbarStyle') === 'native') {
            setTimeout(function () {
                clearMap();
                autoSyncscroll();
                updateScrollspy();
                if (callback && typeof callback === 'function')
                    callback();
            }, 1);
        } else {
            // force it load all docs at once to prevent scroll knob blink
            editor.setOption('viewportMargin', Infinity);
            setTimeout(function () {
                clearMap();
                autoSyncscroll();
                editor.setOption('viewportMargin', viewportMargin);
                //add or update user cursors
                for (var i = 0; i < onlineUsers.length; i++) {
                    if (onlineUsers[i].id != personalInfo.id)
                        buildCursor(onlineUsers[i]);
                }
                updateScrollspy();
                if (callback && typeof callback === 'function')
                    callback();
            }, 1);
        }
    }
}

function checkLayout() {
    var navbarHieght = $('.navbar').outerHeight();
    $('body').css('padding-top', navbarHieght + 'px');
}

function editorHasFocus() {
    return $(editor.getInputField()).is(":focus");
}

//768-792px have a gap
function checkResponsive() {
    visibleXS = $(".visible-xs").is(":visible");
    visibleSM = $(".visible-sm").is(":visible");
    visibleMD = $(".visible-md").is(":visible");
    visibleLG = $(".visible-lg").is(":visible");

    if (visibleXS && currentMode == modeType.both)
        if (editorHasFocus())
            changeMode(modeType.edit);
        else
            changeMode(modeType.view);

    emitUserStatus();
}

var lastEditorWidth = 0;
var previousFocusOnEditor = null;

function checkEditorStyle() {
    var desireHeight = statusBar ? (ui.area.edit.height() - statusBar.outerHeight()) : ui.area.edit.height();
    // set editor height and min height based on scrollbar style and mode
    var scrollbarStyle = editor.getOption('scrollbarStyle');
    if (scrollbarStyle == 'overlay' || currentMode == modeType.both) {
        ui.area.codemirrorScroll.css('height', desireHeight + 'px');
        ui.area.codemirrorScroll.css('min-height', '');
        checkEditorScrollbar();
    } else if (scrollbarStyle == 'native') {
        ui.area.codemirrorScroll.css('height', '');
        ui.area.codemirrorScroll.css('min-height', desireHeight + 'px');
    }
    // workaround editor will have wrong doc height when editor height changed
    editor.setSize(null, ui.area.edit.height());
    //make editor resizable
    if (!ui.area.resize.handle.length) {
        ui.area.edit.resizable({
            handles: 'e',
            maxWidth: $(window).width() * 0.7,
            minWidth: $(window).width() * 0.2,
            create: function (e, ui) {
                $(this).parent().on('resize', function (e) {
                    e.stopPropagation();
                });
            },
            start: function (e) {
                editor.setOption('viewportMargin', Infinity);
            },
            resize: function (e) {
                ui.area.resize.syncToggle.stop(true, true).show();
                checkTocStyle();
            },
            stop: function (e) {
                lastEditorWidth = ui.area.edit.width();
                // workaround that scroll event bindings
                preventSyncScrollToView = 2;
                preventSyncScrollToEdit = true;
                editor.setOption('viewportMargin', viewportMargin);
                if (editorHasFocus()) {
                    windowResizeInner(function () {
                        ui.area.codemirrorScroll.scroll();
                    });
                } else {
                    windowResizeInner(function () {
                        ui.area.view.scroll();
                    });
                }
                checkEditorScrollbar();
            }
        });
        ui.area.resize.handle = $('.ui-resizable-handle');
    }
    if (!ui.area.resize.syncToggle.length) {
        ui.area.resize.syncToggle = $('<button class="btn btn-lg btn-default ui-sync-toggle" title="Toggle sync scrolling"><i class="fa fa-link fa-fw"></i></button>');
        ui.area.resize.syncToggle.hover(function () {
            previousFocusOnEditor = editorHasFocus();
        }, function () {
            previousFocusOnEditor = null;
        });
        ui.area.resize.syncToggle.click(function () {
            syncscroll = !syncscroll;
            checkSyncToggle();
        });
        ui.area.resize.handle.append(ui.area.resize.syncToggle);
        ui.area.resize.syncToggle.hide();
        ui.area.resize.handle.hover(function () {
            ui.area.resize.syncToggle.stop(true, true).delay(200).fadeIn(100);
        }, function () {
            ui.area.resize.syncToggle.stop(true, true).delay(300).fadeOut(300);
        });
    }
}

function checkSyncToggle() {
    if (syncscroll) {
        if (previousFocusOnEditor) {
            preventSyncScrollToView = false;
            syncScrollToView();
        } else {
            preventSyncScrollToEdit = false;
            syncScrollToEdit();
        }
        ui.area.resize.syncToggle.find('i').removeClass('fa-unlink').addClass('fa-link');
    } else {
        ui.area.resize.syncToggle.find('i').removeClass('fa-link').addClass('fa-unlink');
    }
}

function checkEditorScrollbar() {
    // workaround simple scroll bar knob
    // will get wrong position when editor height changed
    var scrollInfo = editor.getScrollInfo();
    editor.scrollTo(null, scrollInfo.top - 1);
    editor.scrollTo(null, scrollInfo.top);
}

function checkTocStyle() {
    //toc right
    var paddingRight = parseFloat(ui.area.markdown.css('padding-right'));
    var right = ($(window).width() - (ui.area.markdown.offset().left + ui.area.markdown.outerWidth() - paddingRight));
    ui.toc.toc.css('right', right + 'px');
    //affix toc left
    var newbool;
    var rightMargin = (ui.area.markdown.parent().outerWidth() - ui.area.markdown.outerWidth()) / 2;
    //for ipad or wider device
    if (rightMargin >= 133) {
        newbool = true;
        var affixLeftMargin = (ui.toc.affix.outerWidth() - ui.toc.affix.width()) / 2;
        var left = ui.area.markdown.offset().left + ui.area.markdown.outerWidth() - affixLeftMargin;
        ui.toc.affix.css('left', left + 'px');
        ui.toc.affix.css('width', rightMargin + 'px');
    } else {
        newbool = false;
    }
    //toc scrollspy
    ui.toc.toc.removeClass('scrollspy-body, scrollspy-view');
    ui.toc.affix.removeClass('scrollspy-body, scrollspy-view');
    if (currentMode == modeType.both) {
        ui.toc.toc.addClass('scrollspy-view');
        ui.toc.affix.addClass('scrollspy-view');
    } else if (currentMode != modeType.both && !newbool) {
        ui.toc.toc.addClass('scrollspy-body');
        ui.toc.affix.addClass('scrollspy-body');
    } else {
        ui.toc.toc.addClass('scrollspy-view');
        ui.toc.affix.addClass('scrollspy-body');
    }
    if (newbool != enoughForAffixToc) {
        enoughForAffixToc = newbool;
        generateScrollspy();
    }
}

function showStatus(type, num) {
    currentStatus = type;
    var shortStatus = ui.toolbar.shortStatus;
    var status = ui.toolbar.status;
    var label = $('<span class="label"></span>');
    var fa = $('<i class="fa"></i>');
    var msg = "";
    var shortMsg = "";

    shortStatus.html("");
    status.html("");

    switch (currentStatus) {
        case statusType.connected:
            label.addClass(statusType.connected.label);
            fa.addClass(statusType.connected.fa);
            msg = statusType.connected.msg;
            break;
        case statusType.online:
            label.addClass(statusType.online.label);
            fa.addClass(statusType.online.fa);
            shortMsg = num;
            msg = num + " " + statusType.online.msg;
            break;
        case statusType.offline:
            label.addClass(statusType.offline.label);
            fa.addClass(statusType.offline.fa);
            msg = statusType.offline.msg;
            break;
    }

    label.append(fa);
    var shortLabel = label.clone();

    shortLabel.append(" " + shortMsg);
    shortStatus.append(shortLabel);

    label.append(" " + msg);
    status.append(label);
}

function toggleMode() {
    switch (currentMode) {
        case modeType.edit:
            changeMode(modeType.view);
            break;
        case modeType.view:
            changeMode(modeType.edit);
            break;
        case modeType.both:
            changeMode(modeType.view);
            break;
    }
}

var lastMode = null;

function changeMode(type) {
    // lock navbar to prevent it hide after changeMode
    lockNavbar();
    saveInfo();
    if (type) {
        lastMode = currentMode;
        currentMode = type;
    }
    var responsiveClass = "col-lg-6 col-md-6 col-sm-6";
    var scrollClass = "ui-scrollable";
    ui.area.codemirror.removeClass(scrollClass);
    ui.area.edit.removeClass(responsiveClass);
    ui.area.view.removeClass(scrollClass);
    ui.area.view.removeClass(responsiveClass);
    switch (currentMode) {
        case modeType.edit:
            ui.area.edit.show();
            ui.area.view.hide();
            if (!editShown) {
                editor.refresh();
                editShown = true;
            }
            break;
        case modeType.view:
            ui.area.edit.hide();
            ui.area.view.show();
            break;
        case modeType.both:
            ui.area.codemirror.addClass(scrollClass);
            ui.area.edit.addClass(responsiveClass).show();
            ui.area.view.addClass(scrollClass);
            ui.area.view.show();
            break;
    }
    // save mode to url
    if (history.replaceState && loaded) history.replaceState(null, "", serverurl + '/' + noteid + '?' + currentMode.name);
    if (currentMode == modeType.view) {
        editor.getInputField().blur();
    }
    if (currentMode == modeType.edit || currentMode == modeType.both) {
        ui.toolbar.uploadImage.fadeIn();
        //add and update status bar
        if (!statusBar) {
            addStatusBar();
            updateStatusBar();
        }
        //work around foldGutter might not init properly
        editor.setOption('foldGutter', false);
        editor.setOption('foldGutter', true);
    } else {
        ui.toolbar.uploadImage.fadeOut();
    }
    if (currentMode != modeType.edit) {
        $(document.body).css('background-color', 'white');
        updateView();
    } else {
        $(document.body).css('background-color', ui.area.codemirror.css('background-color'));
    }
    //check resizable editor style
    if (currentMode == modeType.both) {
        if (lastEditorWidth > 0)
            ui.area.edit.css('width', lastEditorWidth + 'px');
        else
            ui.area.edit.css('width', '');
        ui.area.resize.handle.show();
    } else {
        ui.area.edit.css('width', '');
        ui.area.resize.handle.hide();
    }

    windowResizeInner();

    restoreInfo();

    if (lastMode == modeType.view && currentMode == modeType.both) {
        preventSyncScrollToView = 2;
        syncScrollToEdit(null, true);
    }

    if (lastMode == modeType.edit && currentMode == modeType.both) {
        preventSyncScrollToEdit = 2;
        syncScrollToView(null, true);
    }

    if (lastMode == modeType.both && currentMode != modeType.both) {
        preventSyncScrollToView = false;
        preventSyncScrollToEdit = false;
    }

    if (lastMode != modeType.edit && currentMode == modeType.edit) {
        editor.refresh();
    }

    $(document.body).scrollspy('refresh');
    ui.area.view.scrollspy('refresh');

    ui.toolbar.both.removeClass("active");
    ui.toolbar.edit.removeClass("active");
    ui.toolbar.view.removeClass("active");
    var modeIcon = ui.toolbar.mode.find('i');
    modeIcon.removeClass('fa-pencil').removeClass('fa-eye');
    if (ui.area.edit.is(":visible") && ui.area.view.is(":visible")) { //both
        ui.toolbar.both.addClass("active");
        modeIcon.addClass('fa-eye');
    } else if (ui.area.edit.is(":visible")) { //edit
        ui.toolbar.edit.addClass("active");
        modeIcon.addClass('fa-eye');
    } else if (ui.area.view.is(":visible")) { //view
        ui.toolbar.view.addClass("active");
        modeIcon.addClass('fa-pencil');
    }
    unlockNavbar();
}

function lockNavbar() {
    $('.navbar').addClass('locked');
}

var unlockNavbar = _.debounce(function () {
    $('.navbar').removeClass('locked');
}, 200);

function closestIndex(arr, closestTo) {
    var closest = Math.max.apply(null, arr); //Get the highest number in arr in case it match nothing.
    var index = 0;
    for (var i = 0; i < arr.length; i++) { //Loop the array
        if (arr[i] >= closestTo && arr[i] < closest) {
            closest = arr[i]; //Check if it's higher than your number, but lower than your closest value
            index = i;
        }
    }
    return index; // return the value
}

function showMessageModal(title, header, href, text, success) {
    var modal = $('.message-modal');
    modal.find('.modal-title').html(title);
    modal.find('.modal-body h5').html(header);
    if (href)
        modal.find('.modal-body a').attr('href', href).text(text);
    else
        modal.find('.modal-body a').removeAttr('href').text(text);
    modal.find('.modal-footer button').removeClass('btn-default btn-success btn-danger')
    if (success)
        modal.find('.modal-footer button').addClass('btn-success');
    else
        modal.find('.modal-footer button').addClass('btn-danger');
    modal.modal('show');
}

// check if dropbox app key is set and load scripts
if (DROPBOX_APP_KEY) {
    $('<script>')
        .attr('type', 'text/javascript')
        .attr('src', 'https://www.dropbox.com/static/api/2/dropins.js')
        .attr('id', 'dropboxjs')
        .attr('data-app-key', DROPBOX_APP_KEY)
        .prop('async', true)
        .prop('defer', true)
        .appendTo('body');
} else {
    ui.toolbar.import.dropbox.hide();
    ui.toolbar.export.dropbox.hide();
}

// check if google api key and client id are set and load scripts
if (GOOGLE_API_KEY && GOOGLE_CLIENT_ID) {
    $('<script>')
        .attr('type', 'text/javascript')
        .attr('src', 'https://www.google.com/jsapi?callback=onGoogleAPILoaded')
        .prop('async', true)
        .prop('defer', true)
        .appendTo('body');
} else {
    ui.toolbar.import.googleDrive.hide();
    ui.toolbar.export.googleDrive.hide();
}

function onGoogleAPILoaded() {
    $('<script>')
        .attr('type', 'text/javascript')
        .attr('src', 'https://apis.google.com/js/client:plusone.js?onload=onGoogleClientLoaded')
        .prop('async', true)
        .prop('defer', true)
        .appendTo('body');
}
window.onGoogleAPILoaded = onGoogleAPILoaded;

//button actions
//share
ui.toolbar.publish.attr("href", noteurl + "/publish");
// extra
//slide
ui.toolbar.extra.slide.attr("href", noteurl + "/slide");
//download
//markdown
ui.toolbar.download.markdown.click(function (e) {
    e.preventDefault();
    e.stopPropagation();
    var filename = renderFilename(ui.area.markdown) + '.md';
    var markdown = editor.getValue();
    var blob = new Blob([markdown], {
        type: "text/markdown;charset=utf-8"
    });
    saveAs(blob, filename);
});
//html
ui.toolbar.download.html.click(function (e) {
    e.preventDefault();
    e.stopPropagation();
    exportToHTML(ui.area.markdown);
});
// raw html
ui.toolbar.download.rawhtml.click(function (e) {
    e.preventDefault();
    e.stopPropagation();
    exportToRawHTML(ui.area.markdown);
});
//pdf
ui.toolbar.download.pdf.attr("download", "").attr("href", noteurl + "/pdf");
//export to dropbox
ui.toolbar.export.dropbox.click(function () {
    var filename = renderFilename(ui.area.markdown) + '.md';
    var options = {
        files: [
            {
                'url': noteurl + "/download",
                'filename': filename
            }
        ],
        error: function (errorMessage) {
            console.error(errorMessage);
        }
    };
    Dropbox.save(options);
});
function uploadToGoogleDrive(accessToken) {
    ui.spinner.show();
    var filename = renderFilename(ui.area.markdown) + '.md';
    var markdown = editor.getValue();
    var blob = new Blob([markdown], {
        type: "text/markdown;charset=utf-8"
    });
    blob.name = filename;
    var uploader = new MediaUploader({
        file: blob,
        token: accessToken,
        onComplete: function (data) {
            data = JSON.parse(data);
            showMessageModal('<i class="fa fa-cloud-upload"></i> Export to Google Drive', 'Export Complete!', data.alternateLink, 'Click here to view your file', true);
            ui.spinner.hide();
        },
        onError: function (data) {
            var modal = $('.export-modal');
            showMessageModal('<i class="fa fa-cloud-upload"></i> Export to Google Drive', 'Export Error :(', '', data, false);
            ui.spinner.hide();
        }
    });
    uploader.upload();
}
function googleApiAuth(immediate, callback) {
    gapi.auth.authorize(
        {
            'client_id': GOOGLE_CLIENT_ID,
            'scope': 'https://www.googleapis.com/auth/drive.file',
            'immediate': immediate
        }, callback ? callback : function () { });
}
function onGoogleClientLoaded() {
    googleApiAuth(true);
    buildImportFromGoogleDrive();
}
// export to google drive
ui.toolbar.export.googleDrive.click(function (e) {
    var token = gapi.auth.getToken();
    if (token) {
        uploadToGoogleDrive(token.access_token);
    } else {
        googleApiAuth(false, function (result) {
            uploadToGoogleDrive(result.access_token);
        });
    }
});
//export to gist
ui.toolbar.export.gist.attr("href", noteurl + "/gist");
//export to snippet
ui.toolbar.export.snippet.click(function() {
    ui.spinner.show();
    $.get(serverurl + '/auth/gitlab/callback/' + noteid + '/projects')
        .done(function (data) {
            $("#snippetExportModalAccessToken").val(data.accesstoken);
            $("#snippetExportModalBaseURL").val(data.baseURL);
            $("#snippetExportModalLoading").hide();
            $("#snippetExportModal").modal('toggle');
            $("#snippetExportModalProjects").find('option').remove().end().append('<option value="init" selected="selected" disabled="disabled">Select From Available Projects</option>');
            if (data.projects) {
                data.projects.sort(function(a,b) {
                    return (a.path_with_namespace < b.path_with_namespace) ? -1 : ((a.path_with_namespace > b.path_with_namespace) ? 1 : 0);
                });
                data.projects.forEach(function(project) {
                    if (!project.snippets_enabled
                        || (project.permissions.project_access === null && project.permissions.group_access === null)
                        || (project.permissions.project_access !== null && project.permissions.project_access.access_level < 20))
                    {
                        return;
                    }
                    $('<option>').val(project.id).text(project.path_with_namespace).appendTo("#snippetExportModalProjects");
                });
                $("#snippetExportModalProjects").prop('disabled', false);
            }
            $("#snippetExportModalLoading").hide();
        })
        .fail(function (data) {
            showMessageModal('<i class="fa fa-gitlab"></i> Import from Snippet', 'Unable to fetch gitlab parameters :(', '', '', false);
        })
        .always(function () {
            ui.spinner.hide();
        });
});
//import from dropbox
ui.toolbar.import.dropbox.click(function () {
    var options = {
        success: function (files) {
            ui.spinner.show();
            var url = files[0].link;
            importFromUrl(url);
        },
        linkType: "direct",
        multiselect: false,
        extensions: ['.md', '.html']
    };
    Dropbox.choose(options);
});
// import from google drive
var picker = null;
function buildImportFromGoogleDrive() {
    picker = new FilePicker({
        apiKey: GOOGLE_API_KEY,
        clientId: GOOGLE_CLIENT_ID,
        buttonEl: ui.toolbar.import.googleDrive,
        onSelect: function (file) {
            if (file.downloadUrl) {
                ui.spinner.show();
                var accessToken = gapi.auth.getToken().access_token;
                $.ajax({
                    type: 'GET',
                    beforeSend: function (request) {
                        request.setRequestHeader('Authorization', 'Bearer ' + accessToken);
                    },
                    url: file.downloadUrl,
                    success: function (data) {
                        if (file.fileExtension == 'html')
                            parseToEditor(data);
                        else
                            replaceAll(data);
                    },
                    error: function (data) {
                        showMessageModal('<i class="fa fa-cloud-download"></i> Import from Google Drive', 'Import failed :(', '', data, false);
                    },
                    complete: function () {
                        ui.spinner.hide();
                    }
                });
            }
        }
    });
}
//import from gist
ui.toolbar.import.gist.click(function () {
    //na
});
//import from snippet
ui.toolbar.import.snippet.click(function () {
    ui.spinner.show();
    $.get(serverurl + '/auth/gitlab/callback/' + noteid + '/projects')
        .done(function (data) {
            $("#snippetImportModalAccessToken").val(data.accesstoken);
            $("#snippetImportModalBaseURL").val(data.baseURL);
            $("#snippetImportModalContent").prop('disabled', false);
            $("#snippetImportModalConfirm").prop('disabled', false);
            $("#snippetImportModalLoading").hide();
            $("#snippetImportModal").modal('toggle');
            $("#snippetImportModalProjects").find('option').remove().end().append('<option value="init" selected="selected" disabled="disabled">Select From Available Projects</option>');
            if (data.projects) {
                data.projects.sort(function(a,b) {
                    return (a.path_with_namespace < b.path_with_namespace) ? -1 : ((a.path_with_namespace > b.path_with_namespace) ? 1 : 0);
                });
                data.projects.forEach(function(project) {
                    if (!project.snippets_enabled
                        || (project.permissions.project_access === null && project.permissions.group_access === null)
                        || (project.permissions.project_access !== null && project.permissions.project_access.access_level < 20))
                    {
                        return;
                    }
                    $('<option>').val(project.id).text(project.path_with_namespace).appendTo("#snippetImportModalProjects");
                });
                $("#snippetImportModalProjects").prop('disabled', false);
            }
            $("#snippetImportModalLoading").hide();
        })
        .fail(function (data) {
            showMessageModal('<i class="fa fa-gitlab"></i> Import from Snippet', 'Unable to fetch gitlab parameters :(', '', '', false);
        })
        .always(function () {
            ui.spinner.hide();
        });
});
//import from clipboard
ui.toolbar.import.clipboard.click(function () {
    //na
});
//upload image
ui.toolbar.uploadImage.bind('change', function (e) {
    var files = e.target.files || e.dataTransfer.files;
    e.dataTransfer = {};
    e.dataTransfer.files = files;
    inlineAttach.onDrop(e);
});
//toc
ui.toc.dropdown.click(function (e) {
    e.stopPropagation();
});

//modal actions
var revisions = [];
var revisionViewer = null;
var revisionInsert = [];
var revisionDelete = [];
var revisionInsertAnnotation = null;
var revisionDeleteAnnotation = null;
var revisionList = ui.modal.revision.find('.ui-revision-list');
var revision = null;
var revisionTime = null;
ui.modal.revision.on('show.bs.modal', function (e) {
    $.get(noteurl + '/revision')
        .done(function(data) {
            parseRevisions(data.revision);
            initRevisionViewer();
        })
        .fail(function(err) {

        })
        .always(function() {
            //na
        });
});
function checkRevisionViewer() {
    if (revisionViewer) {
        var container = $(revisionViewer.display.wrapper).parent();
        $(revisionViewer.display.scroller).css('height', container.height() + 'px');
        revisionViewer.refresh();
    }
}
ui.modal.revision.on('shown.bs.modal', checkRevisionViewer);
$(window).resize(checkRevisionViewer);
function parseRevisions(_revisions) {
    if (_revisions.length != revisions) {
        revisions = _revisions;
        var lastRevision = null;
        if (revisionList.children().length > 0) {
            lastRevision = revisionList.find('.active').attr('data-revision-time');
        }
        revisionList.html('');
        for (var i = 0; i < revisions.length; i++) {
            var revision = revisions[i];
            var item = $('<a href="#" class="list-group-item"></a>');
            item.attr('data-revision-time', revision.time);
            if (lastRevision == revision.time) item.addClass('active');
            var itemHeading = $('<h5 class="list-group-item-heading"></h5>');
            itemHeading.html('<i class="fa fa-clock-o"></i> ' + moment(revision.time).format('llll'));
            var itemText = $('<p class="list-group-item-text"></p>');
            itemText.html('<i class="fa fa-file-text"></i> Length: ' + revision.length);
            item.append(itemHeading).append(itemText);
            item.click(function (e) {
                var time = $(this).attr('data-revision-time');
                selectRevision(time);
            });
            revisionList.append(item);
        }
        if (!lastRevision) {
            selectRevision(revisions[0].time);
        }
    }
}
function selectRevision(time) {
    if (time == revisionTime) return;
    $.get(noteurl + '/revision/' + time)
        .done(function(data) {
            revision = data;
            revisionTime = time;
            var lastScrollInfo = revisionViewer.getScrollInfo();
            revisionList.children().removeClass('active');
            revisionList.find('[data-revision-time="' + time + '"]').addClass('active');
            var content = revision.content;
            revisionViewer.setValue(content);
            revisionViewer.scrollTo(null, lastScrollInfo.top);
            revisionInsert = [];
            revisionDelete = [];
            // mark the text which have been insert or delete
            if (revision.patch.length > 0) {
                var bias = 0;
                for (var j = 0; j < revision.patch.length; j++) {
                    var patch = revision.patch[j];
                    var currIndex = patch.start1 + bias;
                    for (var i = 0; i < patch.diffs.length; i++) {
                        var diff = patch.diffs[i];
                        // ignore if diff only contains line breaks
                        if ((diff[1].match(new RegExp("\n", "g")) || []).length == diff[1].length) continue;
                        switch(diff[0]) {
                            case 0: // retain
                                currIndex += diff[1].length;
                            break;
                            case 1: // insert
                                var prePos = revisionViewer.posFromIndex(currIndex);
                                var postPos = revisionViewer.posFromIndex(currIndex + diff[1].length);
                                revisionInsert.push({
                                    from: prePos,
                                    to: postPos
                                });
                                revisionViewer.markText(prePos, postPos, {
                                    css: 'background-color: rgba(230,255,230,0.7); text-decoration: underline;'
                                });
                                currIndex += diff[1].length;
                            break;
                            case -1: // delete
                                var prePos = revisionViewer.posFromIndex(currIndex);
                                revisionViewer.replaceRange(diff[1], prePos);
                                var postPos = revisionViewer.posFromIndex(currIndex + diff[1].length);
                                revisionDelete.push({
                                    from: prePos,
                                    to: postPos
                                });
                                revisionViewer.markText(prePos, postPos, {
                                    css: 'background-color: rgba(255,230,230,0.7); text-decoration: line-through;'
                                });
                                bias += diff[1].length;
                                currIndex += diff[1].length;
                            break;
                        }
                    }
                }
            }
            revisionInsertAnnotation.update(revisionInsert);
            revisionDeleteAnnotation.update(revisionDelete);
        })
        .fail(function(err) {

        })
        .always(function() {
            //na
        });
}
function initRevisionViewer() {
    if (revisionViewer) return;
    var revisionViewerTextArea = document.getElementById("revisionViewer");
    revisionViewer = CodeMirror.fromTextArea(revisionViewerTextArea, {
        mode: defaultEditorMode,
        viewportMargin: viewportMargin,
        lineNumbers: true,
        lineWrapping: true,
        showCursorWhenSelecting: true,
        inputStyle: "textarea",
        gutters: ["CodeMirror-linenumbers"],
        flattenSpans: true,
        addModeClass: true,
        readOnly: true,
        autoRefresh: true,
        scrollbarStyle: 'overlay'
    });
    revisionInsertAnnotation = revisionViewer.annotateScrollbar({ className:"CodeMirror-insert-match" });
    revisionDeleteAnnotation = revisionViewer.annotateScrollbar({ className:"CodeMirror-delete-match" });
    checkRevisionViewer();
}
$('#revisionModalDownload').click(function () {
    if (!revision) return;
    var filename = renderFilename(ui.area.markdown) + '_' + revisionTime + '.md';
    var blob = new Blob([revision.content], {
        type: "text/markdown;charset=utf-8"
    });
    saveAs(blob, filename);
});
$('#revisionModalRevert').click(function () {
    if (!revision) return;
    editor.setValue(revision.content);
    ui.modal.revision.modal('hide');
});
//snippet projects
ui.modal.snippetImportProjects.change(function() {
    var accesstoken = $("#snippetImportModalAccessToken").val(),
        baseURL     = $("#snippetImportModalBaseURL").val(),
        project     = $("#snippetImportModalProjects").val();

    $("#snippetImportModalLoading").show();
    $("#snippetImportModalContent").val('/projects/' + project);
    $.get(baseURL + '/api/v3/projects/' + project + '/snippets?access_token=' + accesstoken)
        .done(function(data) {
            $("#snippetImportModalSnippets").find('option').remove().end().append('<option value="init" selected="selected" disabled="disabled">Select From Available Snippets</option>');
            data.forEach(function(snippet) {
                $('<option>').val(snippet.id).text(snippet.title).appendTo($("#snippetImportModalSnippets"));
            });
            $("#snippetImportModalLoading").hide();
            $("#snippetImportModalSnippets").prop('disabled', false);
        })
        .fail(function(err) {

        })
        .always(function() {
            //na
        });
});
//snippet snippets
ui.modal.snippetImportSnippets.change(function() {
    var project = $("#snippetImportModalProjects").val(),
        snippet = $("#snippetImportModalSnippets").val();

    $("#snippetImportModalContent").val($("#snippetImportModalContent").val() + '/snippets/' + snippet);
})

function scrollToTop() {
    if (currentMode == modeType.both) {
        if (editor.getScrollInfo().top != 0)
            editor.scrollTo(0, 0);
        else
            ui.area.view.animate({
                scrollTop: 0
            }, 100, "linear");
    } else {
        $('body, html').stop(true, true).animate({
            scrollTop: 0
        }, 100, "linear");
    }
}

function scrollToBottom() {
    if (currentMode == modeType.both) {
        var scrollInfo = editor.getScrollInfo();
        var scrollHeight = scrollInfo.height;
        if (scrollInfo.top != scrollHeight)
            editor.scrollTo(0, scrollHeight * 2);
        else
            ui.area.view.animate({
                scrollTop: ui.area.view[0].scrollHeight
            }, 100, "linear");
    } else {
        $('body, html').stop(true, true).animate({
            scrollTop: $(document.body)[0].scrollHeight
        }, 100, "linear");
    }
}

var enoughForAffixToc = true;

//scrollspy
function generateScrollspy() {
    $(document.body).scrollspy({
        target: '.scrollspy-body'
    });
    ui.area.view.scrollspy({
        target: '.scrollspy-view'
    });
    $(document.body).scrollspy('refresh');
    ui.area.view.scrollspy('refresh');
    if (enoughForAffixToc) {
        ui.toc.toc.hide();
        ui.toc.affix.show();
    } else {
        ui.toc.affix.hide();
        ui.toc.toc.show();
    }
    //$(document.body).scroll();
    //ui.area.view.scroll();
}

function updateScrollspy() {
    var headers = ui.area.markdown.find('h1, h2, h3').toArray();
    var headerMap = [];
    for (var i = 0; i < headers.length; i++) {
        headerMap.push($(headers[i]).offset().top - parseInt($(headers[i]).css('margin-top')));
    }
    applyScrollspyActive($(window).scrollTop(), headerMap, headers,
        $('.scrollspy-body'), 0);
    var offset = ui.area.view.scrollTop() - ui.area.view.offset().top;
    applyScrollspyActive(ui.area.view.scrollTop(), headerMap, headers,
        $('.scrollspy-view'), offset - 10);
}

function applyScrollspyActive(top, headerMap, headers, target, offset) {
    var index = 0;
    for (var i = headerMap.length - 1; i >= 0; i--) {
        if (top >= (headerMap[i] + offset) && headerMap[i + 1] && top < (headerMap[i + 1] + offset)) {
            index = i;
            break;
        }
    }
    var header = $(headers[index]);
    var active = target.find('a[href="#' + header.attr('id') + '"]');
    active.closest('li').addClass('active').parent().closest('li').addClass('active').parent().closest('li').addClass('active');
}

// clipboard modal
//fix for wrong autofocus
$('#clipboardModal').on('shown.bs.modal', function () {
    $('#clipboardModal').blur();
});
$("#clipboardModalClear").click(function () {
    $("#clipboardModalContent").html('');
});
$("#clipboardModalConfirm").click(function () {
    var data = $("#clipboardModalContent").html();
    if (data) {
        parseToEditor(data);
        $('#clipboardModal').modal('hide');
        $("#clipboardModalContent").html('');
    }
});

// refresh modal
$('#refreshModalRefresh').click(function () {
    location.reload(true);
});

// gist import modal
$("#gistImportModalClear").click(function () {
    $("#gistImportModalContent").val('');
});
$("#gistImportModalConfirm").click(function () {
    var gisturl = $("#gistImportModalContent").val();
    if (!gisturl) return;
    $('#gistImportModal').modal('hide');
    $("#gistImportModalContent").val('');
    if (!isValidURL(gisturl)) {
        showMessageModal('<i class="fa fa-github"></i> Import from Gist', 'Not a valid URL :(', '', '', false);
        return;
    } else {
        var hostname = url('hostname', gisturl)
        if (hostname !== 'gist.github.com') {
            showMessageModal('<i class="fa fa-github"></i> Import from Gist', 'Not a valid Gist URL :(', '', '', false);
        } else {
            ui.spinner.show();
            $.get('https://api.github.com/gists/' + url('-1', gisturl))
                .done(function (data) {
                    if (data.files) {
                        var contents = "";
                        Object.keys(data.files).forEach(function (key) {
                            contents += key;
                            contents += '\n---\n';
                            contents += data.files[key].content;
                            contents += '\n\n';
                        });
                        replaceAll(contents);
                    } else {
                        showMessageModal('<i class="fa fa-github"></i> Import from Gist', 'Unable to fetch gist files :(', '', '', false);
                    }
                })
                .fail(function (data) {
                    showMessageModal('<i class="fa fa-github"></i> Import from Gist', 'Not a valid Gist URL :(', '', JSON.stringify(data), false);
                })
                .always(function () {
                    ui.spinner.hide();
                });
        }
    }
});

// snippet import modal
$("#snippetImportModalClear").click(function () {
    $("#snippetImportModalContent").val('');
    $("#snippetImportModalProjects").val('init');
    $("#snippetImportModalSnippets").val('init');
    $("#snippetImportModalSnippets").prop('disabled', true);
});
$("#snippetImportModalConfirm").click(function () {
    var snippeturl = $("#snippetImportModalContent").val();
    if (!snippeturl) return;
    $('#snippetImportModal').modal('hide');
    $("#snippetImportModalContent").val('');
    if (!/^.+\/snippets\/.+$/.test(snippeturl)) {
        showMessageModal('<i class="fa fa-github"></i> Import from Snippet', 'Not a valid Snippet URL :(', '', '', false);
    } else {
        ui.spinner.show();
        var accessToken = '?access_token=' + $("#snippetImportModalAccessToken").val();
        var fullURL = $("#snippetImportModalBaseURL").val() + '/api/v3' + snippeturl;
        $.get(fullURL + accessToken)
            .done(function(data) {
                var content = '# ' + (data.title || "Snippet Import");
                var fileInfo = data.file_name.split('.');
                fileInfo[1] = (fileInfo[1]) ? fileInfo[1] : "md";
                $.get(fullURL + '/raw' + accessToken)
                    .done(function (raw) {
                        if (raw) {
                            content += "\n\n";
                            if (fileInfo[1] != "md") {
                                content += "```" + fileTypes[fileInfo[1]] + "\n";
                            }
                            content += raw;
                            if (fileInfo[1] != "md") {
                                content += "\n```";
                            }
                            replaceAll(content);
                        }
                    })
                    .fail(function (data) {
                        showMessageModal('<i class="fa fa-gitlab"></i> Import from Snippet', 'Not a valid Snippet URL :(', '', JSON.stringify(data), false);
                    })
                    .always(function () {
                        ui.spinner.hide();
                    });
            })
            .fail(function (data) {
                showMessageModal('<i class="fa fa-gitlab"></i> Import from Snippet', 'Not a valid Snippet URL :(', '', JSON.stringify(data), false);
            });
    }
});

//snippet export modal
$("#snippetExportModalConfirm").click(function() {
    var accesstoken = $("#snippetExportModalAccessToken").val(),
        baseURL     = $("#snippetExportModalBaseURL").val(),
        data        = {
            title: $("#snippetExportModalTitle").val(),
            file_name: $("#snippetExportModalFileName").val(),
            code: editor.getValue(),
            visibility_level: $("#snippetExportModalVisibility").val()
        };
    if (!data.title || !data.file_name || !data.code || !data.visibility_level || !$("#snippetExportModalProjects").val()) return;
    $("#snippetExportModalLoading").show();
    var fullURL = baseURL + '/api/v3/projects/' + $("#snippetExportModalProjects").val() + '/snippets?access_token=' + accesstoken;
    $.post(fullURL
        , data
        , function(ret) {
            $("#snippetExportModalLoading").hide();
            $('#snippetExportModal').modal('hide');
            var redirect = baseURL + '/' + $("#snippetExportModalProjects option[value='" + $("#snippetExportModalProjects").val() + "']").text() + '/snippets/' + ret.id;
            showMessageModal('<i class="fa fa-gitlab"></i> Export to Snippet', 'Export Successful!', redirect, 'View Snippet Here', true);
        }
        , 'json'
    );
});

function parseToEditor(data) {
    var parsed = toMarkdown(data);
    if (parsed)
        replaceAll(parsed);
}

function replaceAll(data) {
    editor.replaceRange(data, {
        line: 0,
        ch: 0
    }, {
            line: editor.lastLine(),
            ch: editor.lastLine().length
        }, '+input');
}

function importFromUrl(url) {
    //console.log(url);
    if (!url) return;
    if (!isValidURL(url)) {
        showMessageModal('<i class="fa fa-cloud-download"></i> Import from URL', 'Not a valid URL :(', '', '', false);
        return;
    }
    $.ajax({
        method: "GET",
        url: url,
        success: function (data) {
            var extension = url.split('.').pop();
            if (extension == 'html')
                parseToEditor(data);
            else
                replaceAll(data);
        },
        error: function (data) {
            showMessageModal('<i class="fa fa-cloud-download"></i> Import from URL', 'Import failed :(', '', JSON.stringify(data), false);
        },
        complete: function () {
            ui.spinner.hide();
        }
    });
}

//mode
ui.toolbar.mode.click(function () {
    toggleMode();
});
//edit
ui.toolbar.edit.click(function () {
    changeMode(modeType.edit);
});
//view
ui.toolbar.view.click(function () {
    changeMode(modeType.view);
});
//both
ui.toolbar.both.click(function () {
    changeMode(modeType.both);
});
//permission
//freely
ui.infobar.permission.freely.click(function () {
    emitPermission("freely");
});
//editable
ui.infobar.permission.editable.click(function () {
    emitPermission("editable");
});
//locked
ui.infobar.permission.locked.click(function () {
    emitPermission("locked");
});
//private
ui.infobar.permission.private.click(function () {
    emitPermission("private");
});
// delete note
ui.infobar.delete.click(function () {
    $('.delete-modal').modal('show');
});
$('.ui-delete-modal-confirm').click(function () {
    socket.emit('delete');
});

function emitPermission(_permission) {
    if (_permission != permission) {
        socket.emit('permission', _permission);
    }
}

function updatePermission(newPermission) {
    if (permission != newPermission) {
        permission = newPermission;
        if (loaded) refreshView();
    }
    var label = null;
    var title = null;
    switch (permission) {
        case "freely":
            label = '<i class="fa fa-leaf"></i> Freely';
            title = "Anyone can edit";
            break;
        case "editable":
            label = '<i class="fa fa-shield"></i> Editable';
            title = "Signed people can edit";
            break;
        case "locked":
            label = '<i class="fa fa-lock"></i> Locked';
            title = "Only owner can edit";
            break;
        case "private":
            label = '<i class="fa fa-hand-stop-o"></i> Private';
            title = "Only owner can view & edit";
            break;
    }
    if (personalInfo.userid && owner && personalInfo.userid == owner) {
        label += ' <i class="fa fa-caret-down"></i>';
        ui.infobar.permission.label.removeClass('disabled');
    } else {
        ui.infobar.permission.label.addClass('disabled');
    }
    ui.infobar.permission.label.html(label).attr('title', title);
}

function havePermission() {
    var bool = false;
    switch (permission) {
        case "freely":
            bool = true;
            break;
        case "editable":
            if (!personalInfo.login) {
                bool = false;
            } else {
                bool = true;
            }
            break;
        case "locked":
        case "private":
            if (!owner || personalInfo.userid != owner) {
                bool = false;
            } else {
                bool = true;
            }
            break;
    }
    return bool;
}
// global module workaround
window.havePermission = havePermission;

//socket.io actions
var io = require("socket.io-client");
var socket = io.connect({
    path: urlpath ? '/' + urlpath + '/socket.io/' : '',
    timeout: 5000 //5 secs to timeout
});
//overwrite original event for checking login state
var on = socket.on;
socket.on = function () {
    if (!checkLoginStateChanged() && !needRefresh)
        return on.apply(socket, arguments);
};
var emit = socket.emit;
socket.emit = function () {
    if (!checkLoginStateChanged() && !needRefresh)
        emit.apply(socket, arguments);
};
socket.on('info', function (data) {
    console.error(data);
    switch (data.code) {
        case 403:
            location.href = serverurl + "/403";
            break;
        case 404:
            location.href = serverurl + "/404";
            break;
        case 500:
            location.href = serverurl + "/500";
            break;
    }
});
socket.on('error', function (data) {
    console.error(data);
    if (data.message && data.message.indexOf('AUTH failed') === 0)
        location.href = serverurl + "/403";
});
socket.on('delete', function () {
    if (personalInfo.login) {
        deleteServerHistory(noteid, function (err, data) {
            if (!err) location.href = serverurl;
        });
    } else {
        getHistory(function (notehistory) {
            var newnotehistory = removeHistory(noteid, notehistory);
            saveHistory(newnotehistory);
            location.href = serverurl;
        });
    }   
});
var retryOnDisconnect = false;
var retryTimer = null;
socket.on('maintenance', function () {
    cmClient.revision = -1;
    retryOnDisconnect = true;
});
socket.on('disconnect', function (data) {
    showStatus(statusType.offline);
    if (loaded) {
        saveInfo();
        lastInfo.history = editor.getHistory();
    }
    if (!editor.getOption('readOnly'))
        editor.setOption('readOnly', true);
    if (retryOnDisconnect && !retryTimer) {
        retryTimer = setInterval(function () {
            if (!needRefresh) socket.connect();
        }, 1000);
    }
});
socket.on('reconnect', function (data) {
    //sync back any change in offline
    emitUserStatus(true);
    cursorActivity();
    socket.emit('online users');
});
socket.on('connect', function (data) {
    clearInterval(retryTimer);
    retryTimer = null;
    retryOnDisconnect = false;
    personalInfo['id'] = socket.id;
    showStatus(statusType.connected);
    socket.emit('version');
});
socket.on('version', function (data) {
    if (version != data.version) {
        if (version < data.minimumCompatibleVersion) {
            setRefreshModal('incompatible-version');
            setNeedRefresh();
        } else {
            setRefreshModal('new-version');
        }
    }
});
var authors = [];
var authorship = [];
var authorshipMarks = {};
var authorMarks = {}; // temp variable
var addTextMarkers = []; // temp variable
function updateInfo(data) {
    //console.log(data);
    if (data.hasOwnProperty('createtime') && createtime !== data.createtime) {
        createtime = data.createtime;
        updateLastChange();
    }
    if (data.hasOwnProperty('updatetime') && lastchangetime !== data.updatetime) {
        lastchangetime = data.updatetime;
        updateLastChange();
    }
    if (data.hasOwnProperty('owner') && owner !== data.owner) {
        owner = data.owner;
        ownerprofile = data.ownerprofile;
        updateOwner();
    }
    if (data.hasOwnProperty('lastchangeuser') && lastchangeuser !== data.lastchangeuser) {
        lastchangeuser = data.lastchangeuser;
        lastchangeuserprofile = data.lastchangeuserprofile;
        updateLastChangeUser();
        updateOwner();
    }
    if (data.hasOwnProperty('authors') && authors !== data.authors) {
        authors = data.authors;
    }
    if (data.hasOwnProperty('authorship') && authorship !== data.authorship) {
        authorship = data.authorship;
        updateAuthorship();
    }
}
var updateAuthorship = _.throttle(function () {
    editor.operation(updateAuthorshipInner);
}, 50);
function initMark() {
    return {
        gutter: {
            userid: null,
            timestamp: null
        },
        textmarkers: []
    };
}
function initMarkAndCheckGutter(mark, author, timestamp) {
    if (!mark) mark = initMark();
    if (!mark.gutter.userid || mark.gutter.timestamp > timestamp) {
        mark.gutter.userid = author.userid;
        mark.gutter.timestamp = timestamp;
    }
    return mark;
}
var gutterStylePrefix = "border-left: 3px solid ";
var gutterStylePostfix = "; height: " + defaultTextHeight + "px; margin-left: 3px;";
var textMarkderStylePrefix = "background-image: linear-gradient(to top, ";
var textMarkderStylePostfix = " 1px, transparent 1px);";
var addStyleRule = (function () {
    var added = {};
    var styleElement = document.createElement('style');
    document.documentElement.getElementsByTagName('head')[0].appendChild(styleElement);
    var styleSheet = styleElement.sheet;

    return function (css) {
        if (added[css]) {
            return;
        }
        added[css] = true;
        styleSheet.insertRule(css, (styleSheet.cssRules || styleSheet.rules).length);
    };
}());
function updateAuthorshipInner() {
    // ignore when ot not synced yet
    if (cmClient && Object.keys(cmClient.state).length > 0) return;
    authorMarks = {};
    for (var i = 0; i < authorship.length; i++) {
        var atom = authorship[i];
        var author = authors[atom[0]];
        if (author) {
            var prePos = editor.posFromIndex(atom[1]);
            var preLine = editor.getLine(prePos.line);
            var postPos = editor.posFromIndex(atom[2]);
            var postLine = editor.getLine(postPos.line);
            if (prePos.ch == 0 && postPos.ch == postLine.length) {
                for (var j = prePos.line; j <= postPos.line; j++) {
                    if (editor.getLine(j)) {
                        authorMarks[j] = initMarkAndCheckGutter(authorMarks[j], author, atom[3]);
                    }
                }
            } else if (postPos.line - prePos.line >= 1) {
                var startLine = prePos.line;
                var endLine = postPos.line;
                if (prePos.ch == preLine.length) {
                    startLine++;
                } else if (prePos.ch != 0) {
                    var mark = initMarkAndCheckGutter(authorMarks[prePos.line], author, atom[3]);
                    var _postPos = {
                        line: prePos.line,
                        ch: preLine.length
                    };
                    if (JSON.stringify(prePos) != JSON.stringify(_postPos)) {
                        mark.textmarkers.push({
                            userid: author.userid,
                            pos: [prePos, _postPos]
                        });
                        startLine++;
                    }
                    authorMarks[prePos.line] = mark;
                }
                if (postPos.ch == 0) {
                    endLine--;
                } else if (postPos.ch != postLine.length) {
                    var mark = initMarkAndCheckGutter(authorMarks[postPos.line], author, atom[3]);
                    var _prePos = {
                        line: postPos.line,
                        ch: 0
                    };
                    if (JSON.stringify(_prePos) != JSON.stringify(postPos)) {
                        mark.textmarkers.push({
                            userid: author.userid,
                            pos: [_prePos, postPos]
                        });
                        endLine--;
                    }
                    authorMarks[postPos.line] = mark;
                }
                for (var j = startLine; j <= endLine; j++) {
                    if (editor.getLine(j)) {
                        authorMarks[j] = initMarkAndCheckGutter(authorMarks[j], author, atom[3]);
                    }
                }
            } else {
                var mark = initMarkAndCheckGutter(authorMarks[prePos.line], author, atom[3]);
                if (JSON.stringify(prePos) != JSON.stringify(postPos)) {
                    mark.textmarkers.push({
                        userid: author.userid,
                        pos: [prePos, postPos]
                    });
                }
                authorMarks[prePos.line] = mark;
            }
        }
    }
    addTextMarkers = [];
    editor.eachLine(iterateLine);
    var allTextMarks = editor.getAllMarks();
    for (var i = 0; i < allTextMarks.length; i++) {
        var _textMarker = allTextMarks[i];
        var pos = _textMarker.find();
        var found = false;
        for (var j = 0; j < addTextMarkers.length; j++) {
            var textMarker = addTextMarkers[j];
            var author = authors[textMarker.userid];
            var className = 'authorship-inline-' + author.color.substr(1);
            var obj = {
                from: textMarker.pos[0],
                to: textMarker.pos[1]
            };
            if (JSON.stringify(pos) == JSON.stringify(obj) && _textMarker.className &&
                _textMarker.className.indexOf(className) > -1) {
                addTextMarkers.splice(j, 1);
                j--;
                found = true;
                break;
            }
        }
        if (!found && _textMarker.className && _textMarker.className.indexOf('authorship-inline') > -1) {
            _textMarker.clear();
        }
    }
    for (var i = 0; i < addTextMarkers.length; i++) {
        var textMarker = addTextMarkers[i];
        var author = authors[textMarker.userid];
        var rgbcolor = hex2rgb(author.color);
        var colorString = "rgba(" + rgbcolor.red + "," + rgbcolor.green + "," + rgbcolor.blue + ",0.7)";
        var styleString = textMarkderStylePrefix + colorString + textMarkderStylePostfix;
        var className = 'authorship-inline-' + author.color.substr(1);
        var rule = "." + className + "{" + styleString + "}";
        addStyleRule(rule);
        var _textMarker = editor.markText(textMarker.pos[0], textMarker.pos[1], {
            className: 'authorship-inline ' + className,
            title: author.name
        });
    }
    authorshipMarks = authorMarks;
}
function iterateLine(line) {
    var lineNumber = line.lineNo();
    var currMark = authorMarks[lineNumber];
    var author = currMark ? authors[currMark.gutter.userid] : null;
    if (currMark && author) {
        var className = 'authorship-gutter-' + author.color.substr(1);
        var gutters = line.gutterMarkers;
        if (!gutters || !gutters['authorship-gutters'] ||
            !gutters['authorship-gutters'].className ||
            !gutters['authorship-gutters'].className.indexOf(className) < 0) {
            var styleString = gutterStylePrefix + author.color + gutterStylePostfix;
            var rule = "." + className + "{" + styleString + "}";
            addStyleRule(rule);
            var gutter = $('<div>', {
                class: 'authorship-gutter ' + className,
                title: author.name
            });
            editor.setGutterMarker(line, "authorship-gutters", gutter[0]);
        }
    } else {
        editor.setGutterMarker(line, "authorship-gutters", null);
    }
    if (currMark && currMark.textmarkers.length > 0) {
        for (var i = 0; i < currMark.textmarkers.length; i++) {
            var textMarker = currMark.textmarkers[i];
            if (textMarker.userid != currMark.gutter.userid) {
                addTextMarkers.push(textMarker);
            }
        }
    }
}
editor.on('update', function () {
    $('.authorship-gutter:not([data-original-title])').tooltip({
        container: '.CodeMirror-lines',
        placement: 'right',
        delay: { "show": 500, "hide": 100 }
    });
    $('.authorship-inline:not([data-original-title])').tooltip({
        container: '.CodeMirror-lines',
        placement: 'bottom',
        delay: { "show": 500, "hide": 100 }
    });
    // clear tooltip which described element has been removed
    $('[id^="tooltip"]').each(function (index, element) {
        $ele = $(element);
        if ($('[aria-describedby="' + $ele.attr('id') + '"]').length <= 0) $ele.remove();
    });
});
socket.on('check', function (data) {
    data = LZString.decompressFromUTF16(data);
    data = JSON.parse(data);
    //console.log(data);
    updateInfo(data);
});
socket.on('permission', function (data) {
    updatePermission(data.permission);
});
var docmaxlength = null;
var permission = null;
socket.on('refresh', function (data) {
    data = LZString.decompressFromUTF16(data);
    data = JSON.parse(data);
    //console.log(data);
    docmaxlength = data.docmaxlength;
    editor.setOption("maxLength", docmaxlength);
    updateInfo(data);
    updatePermission(data.permission);
    if (!loaded) {
        // auto change mode if no content detected
        var nocontent = editor.getValue().length <= 0;
        if (nocontent) {
            if (visibleXS)
                currentMode = modeType.edit;
            else
                currentMode = modeType.both;
        }
        // parse mode from url
        if (window.location.search.length > 0) {
            var urlMode = modeType[window.location.search.substr(1)];
            if (urlMode) currentMode = urlMode;
        }
        changeMode(currentMode);
        if (nocontent && !visibleXS) {
            editor.focus();
            editor.refresh();
        }
        updateViewInner(); // bring up view rendering earlier
        updateHistory(); //update history whether have content or not
        loaded = true;
        emitUserStatus(); //send first user status
        updateOnlineStatus(); //update first online status
        setTimeout(function () {
            //work around editor not refresh or doc not fully loaded
            windowResizeInner();
            //work around might not scroll to hash
            scrollToHash();
        }, 1);
    }
});

var EditorClient = ot.EditorClient;
var SocketIOAdapter = ot.SocketIOAdapter;
var CodeMirrorAdapter = ot.CodeMirrorAdapter;
var cmClient = null;

socket.on('doc', function (obj) {
    obj = LZString.decompressFromUTF16(obj);
    obj = JSON.parse(obj);
    var body = obj.str;
    var bodyMismatch = editor.getValue() !== body;
    var setDoc = !cmClient || (cmClient && cmClient.revision === -1) || obj.force;

    saveInfo();
    if (setDoc && bodyMismatch) {
        if (cmClient) cmClient.editorAdapter.ignoreNextChange = true;
        if (body) editor.setValue(body);
        else editor.setValue("");
    }

    if (!loaded) {
        editor.clearHistory();
        ui.spinner.hide();
        ui.content.fadeIn();
    } else {
        //if current doc is equal to the doc before disconnect
        if (setDoc && bodyMismatch) editor.clearHistory();
        else if (lastInfo.history) editor.setHistory(lastInfo.history);
        lastInfo.history = null;
    }

    if (!cmClient) {
        cmClient = window.cmClient = new EditorClient(
            obj.revision, obj.clients,
            new SocketIOAdapter(socket), new CodeMirrorAdapter(editor)
        );
    } else if (setDoc) {
        if (bodyMismatch) {
            cmClient.undoManager.undoStack.length = 0;
            cmClient.undoManager.redoStack.length = 0;
        }
        cmClient.revision = obj.revision;
        cmClient.setState(new ot.Client.Synchronized());
        cmClient.initializeClientList();
        cmClient.initializeClients(obj.clients);
    }

    if (setDoc && bodyMismatch) {
        isDirty = true;
        updateView();
    }

    if (editor.getOption('readOnly'))
        editor.setOption('readOnly', false);

    restoreInfo();
});

socket.on('ack', function () {
    isDirty = true;
    updateView();
});

socket.on('operation', function () {
    isDirty = true;
    updateView();
});

socket.on('online users', function (data) {
    data = LZString.decompressFromUTF16(data);
    data = JSON.parse(data);
    if (debug)
        console.debug(data);
    onlineUsers = data.users;
    updateOnlineStatus();
    $('.other-cursors').children().each(function (key, value) {
        var found = false;
        for (var i = 0; i < data.users.length; i++) {
            var user = data.users[i];
            if ($(this).attr('id') == user.id)
                found = true;
        }
        if (!found)
            $(this).stop(true).fadeOut("normal", function () {
                $(this).remove();
            });
    });
    for (var i = 0; i < data.users.length; i++) {
        var user = data.users[i];
        if (user.id != socket.id)
            buildCursor(user);
        else
            personalInfo = user;
    }
});
socket.on('user status', function (data) {
    if (debug)
        console.debug(data);
    for (var i = 0; i < onlineUsers.length; i++) {
        if (onlineUsers[i].id == data.id) {
            onlineUsers[i] = data;
        }
    }
    updateOnlineStatus();
    if (data.id != socket.id)
        buildCursor(data);
});
socket.on('cursor focus', function (data) {
    if (debug)
        console.debug(data);
    for (var i = 0; i < onlineUsers.length; i++) {
        if (onlineUsers[i].id == data.id) {
            onlineUsers[i].cursor = data.cursor;
        }
    }
    if (data.id != socket.id)
        buildCursor(data);
    //force show
    var cursor = $('div[data-clientid="' + data.id + '"]');
    if (cursor.length > 0) {
        cursor.stop(true).fadeIn();
    }
});
socket.on('cursor activity', function (data) {
    if (debug)
        console.debug(data);
    for (var i = 0; i < onlineUsers.length; i++) {
        if (onlineUsers[i].id == data.id) {
            onlineUsers[i].cursor = data.cursor;
        }
    }
    if (data.id != socket.id)
        buildCursor(data);
});
socket.on('cursor blur', function (data) {
    if (debug)
        console.debug(data);
    for (var i = 0; i < onlineUsers.length; i++) {
        if (onlineUsers[i].id == data.id) {
            onlineUsers[i].cursor = null;
        }
    }
    if (data.id != socket.id)
        buildCursor(data);
    //force hide
    var cursor = $('div[data-clientid="' + data.id + '"]');
    if (cursor.length > 0) {
        cursor.stop(true).fadeOut();
    }
});

var options = {
    valueNames: ['id', 'name'],
    item: '<li class="ui-user-item">\
            <span class="id" style="display:none;"></span>\
            <a href="#">\
                <span class="pull-left"><i class="ui-user-icon"></i></span><span class="ui-user-name name"></span><span class="pull-right"><i class="fa fa-circle ui-user-status"></i></span>\
            </a>\
           </li>'
};
var onlineUserList = new List('online-user-list', options);
var shortOnlineUserList = new List('short-online-user-list', options);

function updateOnlineStatus() {
    if (!loaded || !socket.connected) return;
    var _onlineUsers = deduplicateOnlineUsers(onlineUsers);
    showStatus(statusType.online, _onlineUsers.length);
    var items = onlineUserList.items;
    //update or remove current list items
    for (var i = 0; i < items.length; i++) {
        var found = false;
        var foundindex = null;
        for (var j = 0; j < _onlineUsers.length; j++) {
            if (items[i].values().id == _onlineUsers[j].id) {
                foundindex = j;
                found = true;
                break;
            }
        }
        var id = items[i].values().id;
        if (found) {
            onlineUserList.get('id', id)[0].values(_onlineUsers[foundindex]);
            shortOnlineUserList.get('id', id)[0].values(_onlineUsers[foundindex]);
        } else {
            onlineUserList.remove('id', id);
            shortOnlineUserList.remove('id', id);
        }
    }
    //add not in list items
    for (var i = 0; i < _onlineUsers.length; i++) {
        var found = false;
        for (var j = 0; j < items.length; j++) {
            if (items[j].values().id == _onlineUsers[i].id) {
                found = true;
                break;
            }
        }
        if (!found) {
            onlineUserList.add(_onlineUsers[i]);
            shortOnlineUserList.add(_onlineUsers[i]);
        }
    }
    //sorting
    sortOnlineUserList(onlineUserList);
    sortOnlineUserList(shortOnlineUserList);
    //render list items
    renderUserStatusList(onlineUserList);
    renderUserStatusList(shortOnlineUserList);
}

function sortOnlineUserList(list) {
    //sort order by isSelf, login state, idle state, alphabet name, color brightness
    list.sort('', {
        sortFunction: function (a, b) {
            var usera = a.values();
            var userb = b.values();
            var useraIsSelf = (usera.id == personalInfo.id || (usera.login && usera.userid == personalInfo.userid));
            var userbIsSelf = (userb.id == personalInfo.id || (userb.login && userb.userid == personalInfo.userid));
            if (useraIsSelf && !userbIsSelf) {
                return -1;
            } else if (!useraIsSelf && userbIsSelf) {
                return 1;
            } else {
                if (usera.login && !userb.login)
                    return -1;
                else if (!usera.login && userb.login)
                    return 1;
                else {
                    if (!usera.idle && userb.idle)
                        return -1;
                    else if (usera.idle && !userb.idle)
                        return 1;
                    else {
                        if (usera.name && usera.name.toLowerCase() < userb.name.toLowerCase()) {
                            return -1;
                        } else if (usera.name && usera.name.toLowerCase() > userb.name.toLowerCase()) {
                            return 1;
                        } else {
                            if (usera.color && usera.color.toLowerCase() < userb.color.toLowerCase())
                                return -1;
                            else if (usera.color && usera.color.toLowerCase() > userb.color.toLowerCase())
                                return 1;
                            else
                                return 0;
                        }
                    }
                }
            }
        }
    });
}

function renderUserStatusList(list) {
    var items = list.items;
    for (var j = 0; j < items.length; j++) {
        var item = items[j];
        var userstatus = $(item.elm).find('.ui-user-status');
        var usericon = $(item.elm).find('.ui-user-icon');
        if (item.values().login && item.values().photo) {
            usericon.css('background-image', 'url(' + item.values().photo + ')');
            //add 1px more to right, make it feel aligned
            usericon.css('margin-right', '6px');
            $(item.elm).css('border-left', '4px solid ' + item.values().color);
            usericon.css('margin-left', '-4px');
        } else {
            usericon.css('background-color', item.values().color);
        }
        userstatus.removeClass('ui-user-status-offline ui-user-status-online ui-user-status-idle');
        if (item.values().idle)
            userstatus.addClass('ui-user-status-idle');
        else
            userstatus.addClass('ui-user-status-online');
    }
}

function deduplicateOnlineUsers(list) {
    var _onlineUsers = [];
    for (var i = 0; i < list.length; i++) {
        var user = $.extend({}, list[i]);
        if (!user.userid)
            _onlineUsers.push(user);
        else {
            var found = false;
            for (var j = 0; j < _onlineUsers.length; j++) {
                if (_onlineUsers[j].userid == user.userid) {
                    //keep self color when login
                    if (user.id == personalInfo.id) {
                        _onlineUsers[j].color = user.color;
                    }
                    //keep idle state if any of self client not idle
                    if (!user.idle) {
                        _onlineUsers[j].idle = user.idle;
                        _onlineUsers[j].color = user.color;
                    }
                    found = true;
                    break;
                }
            }
            if (!found)
                _onlineUsers.push(user);
        }
    }
    return _onlineUsers;
}

var userStatusCache = null;

function emitUserStatus(force) {
    if (!loaded) return;
    var type = null;
    if (visibleXS)
        type = 'xs';
    else if (visibleSM)
        type = 'sm';
    else if (visibleMD)
        type = 'md';
    else if (visibleLG)
        type = 'lg';

    personalInfo['idle'] = idle.isAway;
    personalInfo['type'] = type;

    for (var i = 0; i < onlineUsers.length; i++) {
        if (onlineUsers[i].id == personalInfo.id) {
            onlineUsers[i] = personalInfo;
        }
    }

    var userStatus = {
        idle: idle.isAway,
        type: type
    };

    if (force || JSON.stringify(userStatus) != JSON.stringify(userStatusCache)) {
        socket.emit('user status', userStatus);
        userStatusCache = userStatus;
    }
}

function checkCursorTag(coord, ele) {
    if (!ele) return; // return if element not exists
    // set margin
    var tagRightMargin = 0;
    var tagBottomMargin = 2;
    // use sizer to get the real doc size (won't count status bar and gutters)
    var docWidth = ui.area.codemirrorSizer.width();
    var docHeight = ui.area.codemirrorSizer.height();
    // get editor size (status bar not count in)
    var editorWidth = ui.area.codemirror.width();
    var editorHeight = ui.area.codemirror.height();
    // get element size
    var width = ele.outerWidth();
    var height = ele.outerHeight();
    var padding = (ele.outerWidth() - ele.width()) / 2;
    // get coord position
    var left = coord.left;
    var top = coord.top;
    // get doc top offset (to workaround with viewport)
    var docTopOffset = ui.area.codemirrorSizerInner.position().top;
    // set offset
    var offsetLeft = -3;
    var offsetTop = defaultTextHeight;
    // only do when have width and height
    if (width > 0 && height > 0) {
        // flip x when element right bound larger than doc width
        if (left + width + offsetLeft + tagRightMargin > docWidth) {
            offsetLeft = -(width + tagRightMargin) + padding + offsetLeft;
        }
        // flip y when element bottom bound larger than doc height
        // and element top position is larger than element height
        if (top + docTopOffset + height + offsetTop + tagBottomMargin > Math.max(editor.doc.height, editorHeight) && top + docTopOffset > height + tagBottomMargin) {
            offsetTop = -(height);
        }
    }
    // set position
    ele[0].style.left = offsetLeft + 'px';
    ele[0].style.top = offsetTop + 'px';
}

function buildCursor(user) {
    if (currentMode == modeType.view) return;
    if (!user.cursor) return;
    var coord = editor.charCoords(user.cursor, 'windows');
    coord.left = coord.left < 4 ? 4 : coord.left;
    coord.top = coord.top < 0 ? 0 : coord.top;
    var iconClass = 'fa-user';
    switch (user.type) {
        case 'xs':
            iconClass = 'fa-mobile';
            break;
        case 'sm':
            iconClass = 'fa-tablet';
            break;
        case 'md':
            iconClass = 'fa-desktop';
            break;
        case 'lg':
            iconClass = 'fa-desktop';
            break;
    }
    if ($('.other-cursors').length <= 0) {
        $("<div class='other-cursors'>").insertAfter('.CodeMirror-cursors');
    }
    if ($('div[data-clientid="' + user.id + '"]').length <= 0) {
        var cursor = $('<div data-clientid="' + user.id + '" class="other-cursor" style="display:none;"></div>');
        cursor.attr('data-line', user.cursor.line);
        cursor.attr('data-ch', user.cursor.ch);
        cursor.attr('data-offset-left', 0);
        cursor.attr('data-offset-top', 0);

        var cursorbar = $('<div class="cursorbar">&nbsp;</div>');
        cursorbar[0].style.height = defaultTextHeight + 'px';
        cursorbar[0].style.borderLeft = '2px solid ' + user.color;

        var icon = '<i class="fa ' + iconClass + '"></i>';

        var cursortag = $('<div class="cursortag">' + icon + '&nbsp;<span class="name">' + user.name + '</span></div>');
        //cursortag[0].style.background = color;
        cursortag[0].style.color = user.color;

        cursor.attr('data-mode', 'hover');
        cursortag.delay(2000).fadeOut("fast");
        cursor.hover(
            function () {
                if (cursor.attr('data-mode') == 'hover')
                    cursortag.stop(true).fadeIn("fast");
            },
            function () {
                if (cursor.attr('data-mode') == 'hover')
                    cursortag.stop(true).fadeOut("fast");
            });

        function switchMode(ele) {
            if (ele.attr('data-mode') == 'state')
                ele.attr('data-mode', 'hover');
            else if (ele.attr('data-mode') == 'hover')
                ele.attr('data-mode', 'state');
        }

        function switchTag(ele) {
            if (ele.css('display') === 'none')
                ele.stop(true).fadeIn("fast");
            else
                ele.stop(true).fadeOut("fast");
        }
        var hideCursorTagDelay = 2000;
        var hideCursorTagTimer = null;

        function hideCursorTag() {
            if (cursor.attr('data-mode') == 'hover')
                cursortag.fadeOut("fast");
        }
        cursor.on('touchstart', function (e) {
            var display = cursortag.css('display');
            cursortag.stop(true).fadeIn("fast");
            clearTimeout(hideCursorTagTimer);
            hideCursorTagTimer = setTimeout(hideCursorTag, hideCursorTagDelay);
            if (display === 'none') {
                e.preventDefault();
                e.stopPropagation();
            }
        });
        cursortag.on('mousedown touchstart', function (e) {
            if (cursor.attr('data-mode') == 'state')
                switchTag(cursortag);
            switchMode(cursor);
            e.preventDefault();
            e.stopPropagation();
        });

        cursor.append(cursorbar);
        cursor.append(cursortag);

        cursor[0].style.left = coord.left + 'px';
        cursor[0].style.top = coord.top + 'px';
        $('.other-cursors').append(cursor);

        if (!user.idle)
            cursor.stop(true).fadeIn();

        checkCursorTag(coord, cursortag);
    } else {
        var cursor = $('div[data-clientid="' + user.id + '"]');
        var lineDiff = Math.abs(cursor.attr('data-line') - user.cursor.line);
        cursor.attr('data-line', user.cursor.line);
        cursor.attr('data-ch', user.cursor.ch);

        var cursorbar = cursor.find('.cursorbar');
        cursorbar[0].style.height = defaultTextHeight + 'px';
        cursorbar[0].style.borderLeft = '2px solid ' + user.color;

        var cursortag = cursor.find('.cursortag');
        cursortag.find('i').removeClass().addClass('fa').addClass(iconClass);
        cursortag.find(".name").text(user.name);

        if (cursor.css('display') === 'none') {
            cursor[0].style.left = coord.left + 'px';
            cursor[0].style.top = coord.top + 'px';
        } else {
            cursor.animate({
                "left": coord.left,
                "top": coord.top
            }, {
                    duration: cursorAnimatePeriod,
                    queue: false
                });
        }

        if (user.idle && cursor.css('display') !== 'none')
            cursor.stop(true).fadeOut();
        else if (!user.idle && cursor.css('display') === 'none')
            cursor.stop(true).fadeIn();

        checkCursorTag(coord, cursortag);
    }
}

//editor actions
function enforceMaxLength(cm, change) {
    var maxLength = cm.getOption("maxLength");
    if (maxLength && change.update) {
        var str = change.text.join("\n");
        var delta = str.length - (cm.indexFromPos(change.to) - cm.indexFromPos(change.from));
        if (delta <= 0) {
            return false;
        }
        delta = cm.getValue().length + delta - maxLength;
        if (delta > 0) {
            str = str.substr(0, str.length - delta);
            change.update(change.from, change.to, str.split("\n"));
            return true;
        }
    }
    return false;
}
var ignoreEmitEvents = ['setValue', 'ignoreHistory'];
editor.on('beforeChange', function (cm, change) {
    if (debug)
        console.debug(change);
    if (enforceMaxLength(cm, change)) {
        $('.limit-modal').modal('show');
    }
    var isIgnoreEmitEvent = (ignoreEmitEvents.indexOf(change.origin) != -1);
    if (!isIgnoreEmitEvent) {
        if (!havePermission()) {
            change.canceled = true;
            switch (permission) {
                case "editable":
                    $('.signin-modal').modal('show');
                    break;
                case "locked":
                case "private":
                    $('.locked-modal').modal('show');
                    break;
            }
        }
    } else {
        if (change.origin == 'ignoreHistory') {
            setHaveUnreadChanges(true);
            updateTitleReminder();
        }
    }
    if (cmClient && !socket.connected)
        cmClient.editorAdapter.ignoreNextChange = true;
});
editor.on('cut', function () {
    //na
});
editor.on('paste', function () {
    //na
});
editor.on('changes', function (cm, changes) {
    updateHistory();
    var docLength = editor.getValue().length;
    //workaround for big documents
    var newViewportMargin = 20;
    if (docLength > 20000) {
        newViewportMargin = 1;
    } else if (docLength > 10000) {
        newViewportMargin = 10;
    } else if (docLength > 5000) {
        newViewportMargin = 15;
    }
    if (newViewportMargin != viewportMargin) {
        viewportMargin = newViewportMargin;
        windowResize();
    }
    checkEditorScrollbar();
    if (ui.area.codemirrorScroll[0].scrollHeight > ui.area.view[0].scrollHeight && editorHasFocus()) {
        postUpdateEvent = function () {
            syncScrollToView();
            postUpdateEvent = null;
        };
    }
});
editor.on('focus', function (cm) {
    for (var i = 0; i < onlineUsers.length; i++) {
        if (onlineUsers[i].id == personalInfo.id) {
            onlineUsers[i].cursor = editor.getCursor();
        }
    }
    personalInfo['cursor'] = editor.getCursor();
    socket.emit('cursor focus', editor.getCursor());
});
editor.on('cursorActivity', function (cm) {
    updateStatusBar();
    cursorActivity();
});
editor.on('beforeSelectionChange', function (doc, selections) {
    if (selections)
        selection = selections.ranges[0];
    else
        selection = null;
    updateStatusBar();
});

var cursorActivity = _.debounce(cursorActivityInner, cursorActivityDebounce);

function cursorActivityInner() {
    if (editorHasFocus() && !Visibility.hidden()) {
        for (var i = 0; i < onlineUsers.length; i++) {
            if (onlineUsers[i].id == personalInfo.id) {
                onlineUsers[i].cursor = editor.getCursor();
            }
        }
        personalInfo['cursor'] = editor.getCursor();
        socket.emit('cursor activity', editor.getCursor());
    }
}
editor.on('blur', function (cm) {
    for (var i = 0; i < onlineUsers.length; i++) {
        if (onlineUsers[i].id == personalInfo.id) {
            onlineUsers[i].cursor = null;
        }
    }
    personalInfo['cursor'] = null;
    socket.emit('cursor blur');
});

function saveInfo() {
    var scrollbarStyle = editor.getOption('scrollbarStyle');
    var left = $(window).scrollLeft();
    var top = $(window).scrollTop();
    switch (currentMode) {
        case modeType.edit:
            if (scrollbarStyle == 'native') {
                lastInfo.edit.scroll.left = left;
                lastInfo.edit.scroll.top = top;
            } else {
                lastInfo.edit.scroll = editor.getScrollInfo();
            }
            break;
        case modeType.view:
            lastInfo.view.scroll.left = left;
            lastInfo.view.scroll.top = top;
            break;
        case modeType.both:
            lastInfo.edit.scroll = editor.getScrollInfo();
            lastInfo.view.scroll.left = ui.area.view.scrollLeft();
            lastInfo.view.scroll.top = ui.area.view.scrollTop();
            break;
    }
    lastInfo.edit.cursor = editor.getCursor();
    lastInfo.needRestore = true;
}

function restoreInfo() {
    var scrollbarStyle = editor.getOption('scrollbarStyle');
    if (lastInfo.needRestore) {
        var line = lastInfo.edit.cursor.line;
        var ch = lastInfo.edit.cursor.ch;
        editor.setCursor(line, ch);
        switch (currentMode) {
            case modeType.edit:
                if (scrollbarStyle == 'native') {
                    $(window).scrollLeft(lastInfo.edit.scroll.left);
                    $(window).scrollTop(lastInfo.edit.scroll.top);
                } else {
                    var left = lastInfo.edit.scroll.left;
                    var top = lastInfo.edit.scroll.top;
                    editor.scrollIntoView();
                    editor.scrollTo(left, top);
                }
                break;
            case modeType.view:
                $(window).scrollLeft(lastInfo.view.scroll.left);
                $(window).scrollTop(lastInfo.view.scroll.top);
                break;
            case modeType.both:
                var left = lastInfo.edit.scroll.left;
                var top = lastInfo.edit.scroll.top;
                editor.scrollIntoView();
                editor.scrollTo(left, top);
                ui.area.view.scrollLeft(lastInfo.view.scroll.left);
                ui.area.view.scrollTop(lastInfo.view.scroll.top);
                break;
        }

        lastInfo.needRestore = false;
    }
}

//view actions
function refreshView() {
    ui.area.markdown.html('');
    isDirty = true;
    updateViewInner();
}

var updateView = _.debounce(function () {
    editor.operation(updateViewInner);
}, updateViewDebounce);

var lastResult = null;
var postUpdateEvent = null;

function updateViewInner() {
    if (currentMode == modeType.edit || !isDirty) return;
    var value = editor.getValue();
    var lastMeta = md.meta;
    md.meta = {};
    var rendered = md.render(value);
    if (md.meta.type && md.meta.type === 'slide') {
        var slideOptions = {
            separator: '^(\r\n?|\n)---(\r\n?|\n)$',
            verticalSeparator: '^(\r\n?|\n)----(\r\n?|\n)$'
        };
        var slides = RevealMarkdown.slidify(editor.getValue(), slideOptions);
        ui.area.markdown.html(slides);
        RevealMarkdown.initialize();
        // prevent XSS
        ui.area.markdown.html(preventXSS(ui.area.markdown.html()));
        ui.area.markdown.addClass('slides');
        syncscroll = false;
        checkSyncToggle();
    } else {
        if (lastMeta.type && lastMeta.type === 'slide') {
            refreshView();
            ui.area.markdown.removeClass('slides');
            syncscroll = true;
            checkSyncToggle();
        }
        // only render again when meta changed
        if (JSON.stringify(md.meta) != JSON.stringify(lastMeta)) {
            parseMeta(md, ui.area.codemirror, ui.area.markdown, $('#ui-toc'), $('#ui-toc-affix'));
            rendered = md.render(value);
        }
        // prevent XSS
        rendered = preventXSS(rendered);
        var result = postProcess(rendered).children().toArray();
        partialUpdate(result, lastResult, ui.area.markdown.children().toArray());
        if (result && lastResult && result.length != lastResult.length)
            updateDataAttrs(result, ui.area.markdown.children().toArray());
        lastResult = $(result).clone();
    }
    finishView(ui.area.markdown);
    autoLinkify(ui.area.markdown);
    deduplicatedHeaderId(ui.area.markdown);
    renderTOC(ui.area.markdown);
    generateToc('ui-toc');
    generateToc('ui-toc-affix');
    generateScrollspy();
    updateScrollspy();
    smoothHashScroll();
    isDirty = false;
    clearMap();
    //buildMap();
    updateTitleReminder();
    if (postUpdateEvent && typeof postUpdateEvent === 'function')
        postUpdateEvent();
}

var updateHistoryDebounce = 600;

var updateHistory = _.debounce(updateHistoryInner, updateHistoryDebounce)

function updateHistoryInner() {
    writeHistory(ui.area.markdown);
}

function updateDataAttrs(src, des) {
    //sync data attr startline and endline
    for (var i = 0; i < src.length; i++) {
        copyAttribute(src[i], des[i], 'data-startline');
        copyAttribute(src[i], des[i], 'data-endline');
    }
}

function partialUpdate(src, tar, des) {
    if (!src || src.length == 0 || !tar || tar.length == 0 || !des || des.length == 0) {
        ui.area.markdown.html(src);
        return;
    }
    if (src.length == tar.length) { //same length
        for (var i = 0; i < src.length; i++) {
            copyAttribute(src[i], des[i], 'data-startline');
            copyAttribute(src[i], des[i], 'data-endline');
            var rawSrc = cloneAndRemoveDataAttr(src[i]);
            var rawTar = cloneAndRemoveDataAttr(tar[i]);
            if (rawSrc.outerHTML != rawTar.outerHTML) {
                //console.log(rawSrc);
                //console.log(rawTar);
                $(des[i]).replaceWith(src[i]);
            }
        }
    } else { //diff length
        var start = 0;
        var end = 0;
        //find diff start position
        for (var i = 0; i < tar.length; i++) {
            //copyAttribute(src[i], des[i], 'data-startline');
            //copyAttribute(src[i], des[i], 'data-endline');
            var rawSrc = cloneAndRemoveDataAttr(src[i]);
            var rawTar = cloneAndRemoveDataAttr(tar[i]);
            if (!rawSrc || !rawTar || rawSrc.outerHTML != rawTar.outerHTML) {
                start = i;
                break;
            }
        }
        //find diff end position
        var srcEnd = 0;
        var tarEnd = 0;
        for (var i = 0; i < src.length; i++) {
            //copyAttribute(src[i], des[i], 'data-startline');
            //copyAttribute(src[i], des[i], 'data-endline');
            var rawSrc = cloneAndRemoveDataAttr(src[i]);
            var rawTar = cloneAndRemoveDataAttr(tar[i]);
            if (!rawSrc || !rawTar || rawSrc.outerHTML != rawTar.outerHTML) {
                start = i;
                break;
            }
        }
        //tar end
        for (var i = 1; i <= tar.length + 1; i++) {
            var srcLength = src.length;
            var tarLength = tar.length;
            //copyAttribute(src[srcLength - i], des[srcLength - i], 'data-startline');
            //copyAttribute(src[srcLength - i], des[srcLength - i], 'data-endline');
            var rawSrc = cloneAndRemoveDataAttr(src[srcLength - i]);
            var rawTar = cloneAndRemoveDataAttr(tar[tarLength - i]);
            if (!rawSrc || !rawTar || rawSrc.outerHTML != rawTar.outerHTML) {
                tarEnd = tar.length - i;
                break;
            }
        }
        //src end
        for (var i = 1; i <= src.length + 1; i++) {
            var srcLength = src.length;
            var tarLength = tar.length;
            //copyAttribute(src[srcLength - i], des[srcLength - i], 'data-startline');
            //copyAttribute(src[srcLength - i], des[srcLength - i], 'data-endline');
            var rawSrc = cloneAndRemoveDataAttr(src[srcLength - i]);
            var rawTar = cloneAndRemoveDataAttr(tar[tarLength - i]);
            if (!rawSrc || !rawTar || rawSrc.outerHTML != rawTar.outerHTML) {
                srcEnd = src.length - i;
                break;
            }
        }
        //check if tar end overlap tar start
        var overlap = 0;
        for (var i = start; i >= 0; i--) {
            var rawTarStart = cloneAndRemoveDataAttr(tar[i - 1]);
            var rawTarEnd = cloneAndRemoveDataAttr(tar[tarEnd + 1 + start - i]);
            if (rawTarStart && rawTarEnd && rawTarStart.outerHTML == rawTarEnd.outerHTML)
                overlap++;
            else
                break;
        }
        if (debug)
            console.log('overlap:' + overlap);
        //show diff content
        if (debug) {
            console.log('start:' + start);
            console.log('tarEnd:' + tarEnd);
            console.log('srcEnd:' + srcEnd);
        }
        tarEnd += overlap;
        srcEnd += overlap;
        var repeatAdd = (start - srcEnd) < (start - tarEnd);
        var repeatDiff = Math.abs(srcEnd - tarEnd) - 1;
        //push new elements
        var newElements = [];
        if (srcEnd >= start) {
            for (var j = start; j <= srcEnd; j++) {
                if (!src[j]) continue;
                newElements.push(src[j].outerHTML);
            }
        } else if (repeatAdd) {
            for (var j = srcEnd - repeatDiff; j <= srcEnd; j++) {
                if (!des[j]) continue;
                newElements.push(des[j].outerHTML);
            }
        }
        //push remove elements
        var removeElements = [];
        if (tarEnd >= start) {
            for (var j = start; j <= tarEnd; j++) {
                if (!des[j]) continue;
                removeElements.push(des[j]);
            }
        } else if (!repeatAdd) {
            for (var j = start; j <= start + repeatDiff; j++) {
                if (!des[j]) continue;
                removeElements.push(des[j]);
            }
        }
        //add elements
        if (debug) {
            console.log('ADD ELEMENTS');
            console.log(newElements.join('\n'));
        }
        if (des[start])
            $(newElements.join('')).insertBefore(des[start]);
        else
            $(newElements.join('')).insertAfter(des[start - 1]);
        //remove elements
        if (debug)
            console.log('REMOVE ELEMENTS');
        for (var j = 0; j < removeElements.length; j++) {
            if (debug) {
                console.log(removeElements[j].outerHTML);
            }
            if (removeElements[j])
                $(removeElements[j]).remove();
        }
    }
}

function cloneAndRemoveDataAttr(el) {
    if (!el) return;
    var rawEl = $(el).clone();
    rawEl.removeAttr('data-startline data-endline');
    rawEl.find('[data-startline]').removeAttr('data-startline data-endline');
    return rawEl[0];
}

function copyAttribute(src, des, attr) {
    if (src && src.getAttribute(attr) && des)
        des.setAttribute(attr, src.getAttribute(attr));
}

if ($('.cursor-menu').length <= 0) {
    $("<div class='cursor-menu'>").insertAfter('.CodeMirror-cursors');
}

function reverseSortCursorMenu(dropdown) {
    var items = dropdown.find('.textcomplete-item');
    items.sort(function (a, b) {
        return $(b).attr('data-index') - $(a).attr('data-index');
    });
    return items;
}

var lastUpSideDown = false;
var upSideDown = false;

var checkCursorMenu = _.throttle(checkCursorMenuInner, cursorMenuThrottle);

function checkCursorMenuInner() {
    // get element
    var dropdown = $('.cursor-menu > .dropdown-menu');
    // return if not exists
    if (dropdown.length <= 0) return;
    // set margin
    var menuRightMargin = 10;
    var menuBottomMargin = 4;
    // use sizer to get the real doc size (won't count status bar and gutters)
    var docWidth = ui.area.codemirrorSizer.width();
    var docHeight = ui.area.codemirrorSizer.height();
    // get editor size (status bar not count in)
    var editorWidth = ui.area.codemirror.width();
    var editorHeight = ui.area.codemirror.height();
    // get element size
    var width = dropdown.outerWidth();
    var height = dropdown.outerHeight();
    // get cursor
    var cursor = editor.getCursor();
    // set element cursor data
    if (!dropdown.hasClass('other-cursor'))
        dropdown.addClass('other-cursor');
    dropdown.attr('data-line', cursor.line);
    dropdown.attr('data-ch', cursor.ch);
    // get coord position
    var coord = editor.charCoords({
        line: cursor.line,
        ch: cursor.ch
    }, 'windows');
    var left = coord.left;
    var top = coord.top;
    // get doc top offset (to workaround with viewport)
    var docTopOffset = ui.area.codemirrorSizerInner.position().top;
    // set offset
    var offsetLeft = 0;
    var offsetTop = defaultTextHeight;
    // only do when have width and height
    if (width > 0 && height > 0) {
        // make element right bound not larger than doc width
        if (left + width + offsetLeft + menuRightMargin > docWidth)
            offsetLeft = -(left + width - docWidth + menuRightMargin);
        // flip y when element bottom bound larger than doc height
        // and element top position is larger than element height
        if (top + docTopOffset + height + offsetTop + menuBottomMargin > Math.max(editor.doc.height, editorHeight) && top + docTopOffset > height + menuBottomMargin) {
            offsetTop = -(height + menuBottomMargin);
            // reverse sort menu because upSideDown
            dropdown.html(reverseSortCursorMenu(dropdown));
            lastUpSideDown = upSideDown;
            upSideDown = true;
        } else {
            lastUpSideDown = upSideDown;
            upSideDown = false;
        }
    }
    // make menu scroll top only if upSideDown changed
    if (upSideDown !== lastUpSideDown)
        dropdown.scrollTop(dropdown[0].scrollHeight);
    // set element offset data
    dropdown.attr('data-offset-left', offsetLeft);
    dropdown.attr('data-offset-top', offsetTop);
    // set position
    dropdown[0].style.left = left + offsetLeft + 'px';
    dropdown[0].style.top = top + offsetTop + 'px';
}

function checkInIndentCode() {
    // if line starts with tab or four spaces is a code block
    var line = editor.getLine(editor.getCursor().line);
    var isIndentCode = ((line.substr(0, 4) === '    ') || (line.substr(0, 1) === '\t'));
    return isIndentCode;
}

var isInCode = false;

function checkInCode() {
    isInCode = checkAbove(matchInCode) || checkInIndentCode();
}

function checkAbove(method) {
    var cursor = editor.getCursor();
    var text = [];
    for (var i = 0; i < cursor.line; i++) //contain current line
        text.push(editor.getLine(i));
    text = text.join('\n') + '\n' + editor.getLine(cursor.line).slice(0, cursor.ch);
    //console.log(text);
    return method(text);
}

function checkBelow(method) {
    var cursor = editor.getCursor();
    var count = editor.lineCount();
    var text = [];
    for (var i = cursor.line + 1; i < count; i++) //contain current line
        text.push(editor.getLine(i));
    text = editor.getLine(cursor.line).slice(cursor.ch) + '\n' + text.join('\n');
    //console.log(text);
    return method(text);
}

function matchInCode(text) {
    var match;
    match = text.match(/`{3,}/g);
    if (match && match.length % 2) {
        return true;
    } else {
        match = text.match(/`/g);
        if (match && match.length % 2) {
            return true;
        } else {
            return false;
        }
    }
}

var isInContainer = false;
var isInContainerSyntax = false;

function checkInContainer() {
    isInContainer = checkAbove(matchInContainer) && !checkInIndentCode();
}

function checkInContainerSyntax() {
    // if line starts with :::, it's in container syntax
    var line = editor.getLine(editor.getCursor().line);
    isInContainerSyntax = (line.substr(0, 3) === ':::');
}

function matchInContainer(text) {
    var match;
    match = text.match(/:{3,}/g);
    if (match && match.length % 2) {
        return true;
    } else {
        return false;
    }
}

$(editor.getInputField())
    .textcomplete([
        { // emoji strategy
            match: /(^|\n|\s)\B:([\-+\w]*)$/,
            search: function (term, callback) {
                var line = editor.getLine(editor.getCursor().line);
                term = line.match(this.match)[2];
                var list = [];
                $.map(emojify.emojiNames, function (emoji) {
                    if (emoji.indexOf(term) === 0) //match at first character
                        list.push(emoji);
                });
                $.map(emojify.emojiNames, function (emoji) {
                    if (emoji.indexOf(term) !== -1) //match inside the word
                        list.push(emoji);
                });
                callback(list);
            },
            template: function (value) {
                return '<img class="emoji" src="' + serverurl + '/vendor/emojify/images/' + value + '.png"></img> ' + value;
            },
            replace: function (value) {
                return '$1:' + value + ': ';
            },
            index: 1,
            context: function (text) {
                checkInCode();
                checkInContainer();
                checkInContainerSyntax();
                return !isInCode && !isInContainerSyntax;
            }
        },
        { // Code block language strategy
            langs: supportCodeModes,
            charts: supportCharts,
            match: /(^|\n)```(\w+)$/,
            search: function (term, callback) {
                var line = editor.getLine(editor.getCursor().line);
                term = line.match(this.match)[2];
                var list = [];
                $.map(this.langs, function (lang) {
                    if (lang.indexOf(term) === 0 && lang !== term)
                        list.push(lang);
                });
                $.map(this.charts, function (chart) {
                    if (chart.indexOf(term) === 0 && chart !== term)
                        list.push(chart);
                });
                callback(list);
            },
            replace: function (lang) {
                var ending = '';
                if (!checkBelow(matchInCode)) {
                    ending = '\n\n```';
                }
                if (this.langs.indexOf(lang) !== -1)
                    return '$1```' + lang + '=' + ending;
                else if (this.charts.indexOf(lang) !== -1)
                    return '$1```' + lang + ending;
            },
            done: function () {
                var cursor = editor.getCursor();
                var text = [];
                text.push(editor.getLine(cursor.line - 1));
                text.push(editor.getLine(cursor.line));
                text = text.join('\n');
                //console.log(text);
                if (text == '\n```')
                    editor.doc.cm.execCommand("goLineUp");
            },
            context: function (text) {
                return isInCode;
            }
        },
        { // Container strategy
            containers: supportContainers,
            match: /(^|\n):::(\s*)(\w*)$/,
            search: function (term, callback) {
                var line = editor.getLine(editor.getCursor().line);
                term = line.match(this.match)[3].trim();
                var list = [];
                $.map(this.containers, function (container) {
                    if (container.indexOf(term) === 0 && container !== term)
                        list.push(container);
                });
                callback(list);
            },
            replace: function (lang) {
                var ending = '';
                if (!checkBelow(matchInContainer)) {
                    ending = '\n\n:::';
                }
                if (this.containers.indexOf(lang) !== -1)
                    return '$1:::$2' + lang + ending;
            },
            done: function () {
                var cursor = editor.getCursor();
                var text = [];
                text.push(editor.getLine(cursor.line - 1));
                text.push(editor.getLine(cursor.line));
                text = text.join('\n');
                //console.log(text);
                if (text == '\n:::')
                    editor.doc.cm.execCommand("goLineUp");
            },
            context: function (text) {
                return !isInCode && isInContainer;
            }
        },
        { //header
            match: /(?:^|\n)(\s{0,3})(#{1,6}\w*)$/,
            search: function (term, callback) {
                callback($.map(supportHeaders, function (header) {
                    return header.search.indexOf(term) === 0 ? header.text : null;
                }));
            },
            replace: function (value) {
                return '$1' + value;
            },
            context: function (text) {
                return !isInCode;
            }
        },
        { //extra tags for blockquote
            match: /(?:^|\n|\s)(\>.*|\s|)((\^|)\[(\^|)\](\[\]|\(\)|\:|)\s*\w*)$/,
            search: function (term, callback) {
                var line = editor.getLine(editor.getCursor().line);
                quote = line.match(this.match)[1].trim();
                var list = [];
                if (quote.indexOf('>') == 0) {
                    $.map(supportExtraTags, function (extratag) {
                        if (extratag.search.indexOf(term) === 0)
                            list.push(extratag.command());
                    });
                }
                $.map(supportReferrals, function (referral) {
                    if (referral.search.indexOf(term) === 0)
                        list.push(referral.text);
                })
                callback(list);
            },
            replace: function (value) {
                return '$1' + value;
            },
            context: function (text) {
                return !isInCode;
            }
        },
        { //extra tags for list
            match: /(^[>\s]*[\-\+\*]\s(?:\[[x ]\]|.*))(\[\])(\w*)$/,
            search: function (term, callback) {
                var list = [];
                $.map(supportExtraTags, function (extratag) {
                    if (extratag.search.indexOf(term) === 0)
                        list.push(extratag.command());
                });
                $.map(supportReferrals, function (referral) {
                    if (referral.search.indexOf(term) === 0)
                        list.push(referral.text);
                })
                callback(list);
            },
            replace: function (value) {
                return '$1' + value;
            },
            context: function (text) {
                return !isInCode;
            }
        },
        { //referral
            match: /(^\s*|\n|\s{2})((\[\]|\[\]\[\]|\[\]\(\)|\!|\!\[\]|\!\[\]\[\]|\!\[\]\(\))\s*\w*)$/,
            search: function (term, callback) {
                callback($.map(supportReferrals, function (referral) {
                    return referral.search.indexOf(term) === 0 ? referral.text : null;
                }));
            },
            replace: function (value) {
                return '$1' + value;
            },
            context: function (text) {
                return !isInCode;
            }
        },
        { //externals
            match: /(^|\n|\s)\{\}(\w*)$/,
            search: function (term, callback) {
                callback($.map(supportExternals, function (external) {
                    return external.search.indexOf(term) === 0 ? external.text : null;
                }));
            },
            replace: function (value) {
                return '$1' + value;
            },
            context: function (text) {
                return !isInCode;
            }
        }
    ], {
        appendTo: $('.cursor-menu')
    })
    .on({
        'textComplete:beforeSearch': function (e) {
            //NA
        },
        'textComplete:afterSearch': function (e) {
            checkCursorMenu();
        },
        'textComplete:select': function (e, value, strategy) {
            //NA
        },
        'textComplete:show': function (e) {
            $(this).data('autocompleting', true);
            editor.setOption("extraKeys", {
                "Up": function () {
                    return false;
                },
                "Right": function () {
                    editor.doc.cm.execCommand("goCharRight");
                },
                "Down": function () {
                    return false;
                },
                "Left": function () {
                    editor.doc.cm.execCommand("goCharLeft");
                },
                "Enter": function () {
                    return false;
                },
                "Backspace": function () {
                    editor.doc.cm.execCommand("delCharBefore");
                }
            });
        },
        'textComplete:hide': function (e) {
            $(this).data('autocompleting', false);
            editor.setOption("extraKeys", defaultExtraKeys);
        }
    });
