'use strict';

import { window, commands, ExtensionContext, ViewColumn, WebviewPanel } from 'vscode';
import ZookeeperExplorerProvider from './explorer';
import * as zk from './zkApi';


export const treeProvider = new ZookeeperExplorerProvider();

export function activate(context: ExtensionContext) {
    let currentlyOpenedPanels: WebviewPanel[] = [];

    console.log('vscode-zookeeper: Attempting to connect to Zookeeper');
    zk.client.connect();

    window.registerTreeDataProvider('zookeeperExplorer', treeProvider);

    context.subscriptions.push(commands.registerCommand('zookeeper.disconnect', zk.disconnect));

    context.subscriptions.push(commands.registerCommand('zookeeper.setHost', (host) => {
        if(!host) {
            window.showInputBox().then(inputHost => {
                console.log('Attempting to set new Zookeeper host to: ', inputHost);
                zk.createNewConnection(inputHost || 'http://localhost:2181');
            });    
        } else {
            zk.createNewConnection(host);
        }
    }));

    context.subscriptions.push(commands.registerCommand('zookeeper.editNodeData', (nodeData, path) => {
        console.log('Attempting to set node data for path: ', path);
        zk.setNodeData(path, Buffer.from(nodeData));
    }));
    
    context.subscriptions.push(commands.registerCommand('zookeeper.createNode', (path) => {
        if(!path) {
            window.showInputBox().then(inputPath => zk.createNode(inputPath || ''));    
        } else {
            zk.createNode(path);
        }
    }));

    context.subscriptions.push(commands.registerCommand('zookeeper.deleteNode', (path) => {
        if(!path) {
            window.showInputBox().then(inputPath => zk.deleteNode(inputPath || ''));    
        } else {
            zk.deleteNode(path);
        }
    }));

    context.subscriptions.push(commands.registerCommand('zookeeper.viewNode', (nodeData, path) => {
        // Close currently opened panels.
        currentlyOpenedPanels.forEach(panel => panel.dispose()); 

        const panel: WebviewPanel = window.createWebviewPanel(
            'zookeeper', 
            `ZNode - ${path}`, 
            ViewColumn.One, 
            { enableScripts: true } 
        );
        
        currentlyOpenedPanels.push(panel);

        // Wire up message passing
        panel.webview.onDidReceiveMessage(message => {
            console.log('recieved message from webview: ', message);
            switch (message.command) {
                case 'zookeeper.editNodeData':
                    commands.executeCommand('zookeeper.editNodeData', ...message.arguments);
                    return;
            }
        }, undefined, context.subscriptions);

        console.log('Viewing node at path: ', path);

        panel.webview.html =  `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ZNode - ${path}</title>
            <style>
                div.container {display: flex; flex-direction: column; align-items: center; height: 100%; width: 100%;}
                textarea {overflow-y: auto; width: 100%; min-height: 200px;}
                button {margin-left: auto; margin-right: auto; width: 200px; height: 50px; margin-top: 25px;}
            </style>
        </head>
        <body>
            <div class='container'>
                <textarea id="NodeData">${nodeData.toString()}</textarea>
                <button id="Save">Save</button>
                <button id="Parse">JsonPretty</button>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                const saveBtn = document.querySelector('#Save');;
                const prettyJson = document.querySelector('#Parse');

                saveBtn.addEventListener('click', (e) => {
                    const nodeData = document.querySelector('#NodeData').value;
                    const path = '${path}';
                    vscode.postMessage({
                        command: 'zookeeper.editNodeData',
                        arguments: [nodeData, path]
                    });
                });

                prettyJson.addEventListener('click', (e) => {
                    const d = document.querySelector('#NodeData').value
                    document.querySelector('#NodeData').value = JSON.stringify(JSON.parse(d), null, "\t");
                });

            </script>
        </body>
        </html>`;
    }));
}

export function deactivate() {

}