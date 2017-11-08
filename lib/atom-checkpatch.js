'use babel';

import { CompositeDisposable } from 'atom';
import { BufferedProcess, File, Directory } from 'atom';

export default {
        config: {
                linuxPath: {
                        type: 'string',
                        default: '/usr/src/'
                }
        },
        atomCheckpatchView: null,
        modalPanel: null,
        subscriptions: null,
        results: new Map(),

        activate(state) {
                // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
                this.subscriptions = new CompositeDisposable();

                // Register command that toggles this view
                this.subscriptions.add(atom.commands.add('atom-workspace', {
                        'atom-checkpatch:toggle': () => this.toggle()
                }));
        },

        deactivate() {
                this.subscriptions.dispose();
        },

        serialize() {
                return {
                atomCheckpatchViewState: ""
                };
        },

        toggle() {
                this.checkpatch();
        },

        createMessage(severity, file, line, desc, excerpt) {
                return {
                      severity: severity,
                      location: {
                        file: file,
                        position: [[line, 0], [line, 1]]
                      },
                      excerpt: desc,
                      description: excerpt
              };
        },

        consumeIndie(registerIndie) {
                this.linter = registerIndie({
                        name: 'checkpatch',
                });

                this.subscriptions.add(this.linter);
        },

        filterFiles(files, filter){
                var results = [];
                for (var i =0; i < files.length; i++) {
                        var name = files[i].getBaseName();
                        if (!name.endsWith(filter))
                                results.push(files[i]);
                }
                return results;
        },

        findFiles(files, filter){
                var results = [];
                for (var i =0; i < files.length; i++) {
                        var name = files[i].getBaseName();
                        if (name.endsWith(filter))
                                results.push(files[i]);
                }
                return results;
        },

        findSubsystem(file){
                var fileObj = new File(file);
                var dir = fileObj.getParent();
                var files = dir.getEntriesSync();
                while(dir.getPath() != atom.config.get('atom-checkpatch.linuxPath')) {
                        if (this.findFiles(files, 'Kconfig').length == 1)
                                return dir;
                        dir = dir.getParent();
                        files = dir.getEntriesSync();
                }
                return null;
        },

        findSubsystemFiles(subsystem){
                var entries = subsystem.getEntriesSync();
                var results = [];
                var dirs = [];
                var files = [];
                for (var i =0; i < entries.length; i++) {
                        if (entries[i].isDirectory())
                                files = files.concat(this.findSubsystemFiles(entries[i]));
                        else
                                files.push(entries[i]);
                }
                files = this.findFiles(files, '.c');
                files = this.filterFiles(files, '.mod.c');
                return files;
        },

        checkpatch(){
                this.linter.clearMessages();
                const editor = atom.workspace.getActiveTextEditor();
                var editorPath = editor.getPath();
                var subsystem = this.findSubsystem(editorPath);
                var files = this.findSubsystemFiles(subsystem);
                atom.notifications.addInfo('starting checkpatch on subsystem ' + subsystem.getPath());
                for (var i =0; i < files.length; i++) {
                        editorPath = files[i].getPath();
                        editorPath = editorPath.substring(atom.config.get('atom-checkpatch.linuxPath').length);
                        this.runCheckpatch(editorPath);
                }
        },

        checkpatchOutput(output, file) {
                this.results.set(file, this.results.get(file) + output);
        },

        parseCheckpatchItem(item, msgs) {
                try {
                        var idx = 0;
                        descParts = item[idx++].split(':');
                        type = descParts[0];
                        desc = descParts[1];
                        while (!item[idx].startsWith('#') && idx < item.length) {
                                desc += item[idx];
                                idx++;
                        }
                        fileParts = item[idx++].split(':');
                        file = fileParts[2];
                        line = fileParts[3];
                        file = file.trim();
                        file = atom.config.get('atom-checkpatch.linuxPath') + file;
                        line = parseInt(line) - 1;
                        excerpt = '';
                        for (var j=idx; j<item.length; j++) {
                                if (item[j].startsWith('+'))
                                        item[j] = item[j].substring(1);
                                excerpt += item[j];
                        }
                        if (type == 'CHECK')
                          msgs.push(this.createMessage('info', file, line, desc, excerpt));
                        else if(type == 'WARNING')
                          msgs.push(this.createMessage('warning', file, line, desc, excerpt));
                        else if(type == 'ERROR')
                          msgs.push(this.createMessage('error', file, line, desc, excerpt));
                        item = [];
                }
                catch(err){
                        console.debug(err, item);
                }
        },

        parseCheckpatch(outputs, file) {
                var lines = this.results.get(file).split('\n');
                this.results.delete(file);
                if (this.results.size == 0)
                        atom.notifications.addSuccess('checkpatch finished for this subsystem');
                var item = [];
                var msgs = [];
                for(var i=0; i < lines.length; i++) {
                        var line = lines[i];
                        if (line.startsWith('total'))
                                break;
                        item.push(line);
                        if (line == '') {
                                this.parseCheckpatchItem(item, msgs);
                                item = [];
                        }
                }
                this.msgs = this.msgs.concat(msgs);
                this.linter.setAllMessages(this.msgs);
        },

        runCheckpatch(file) {
                options =
                  {cwd: atom.config.get('atom-checkpatch.linuxPath')
                };
                this.results.set(file, '');
                this.msgs = [];
                const command = 'scripts/checkpatch.pl';
                const args = ['-f', file];
                const stdout = (output) => this.checkpatchOutput(output, file);
                const exit = (code) => this.parseCheckpatch(code, file);
                const process = new BufferedProcess({command, args, options, stdout, exit});
        }

};
