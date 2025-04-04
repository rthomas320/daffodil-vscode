/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as vscode from 'vscode'
import * as daf from './daffodilDebugger'
import * as fs from 'fs'
import { Uri } from 'vscode'
import {
  onDebugStartDisplay,
  getCurrentConfig,
  ensureFile,
  tmpFile,
} from './utils'
import * as path from 'path'

// Function to display an infomation message that the infoset file has been created
// If the user wishes to open the file then they may click the 'Open' button
async function openInfosetFilePrompt() {
  let config = getCurrentConfig()

  if (config.infosetOutput.type === 'file') {
    let rootPath = vscode.workspace.workspaceFolders
      ? vscode.workspace.workspaceFolders[0].uri.fsPath
      : vscode.Uri.parse('').fsPath
    let infosetPath = config.infosetOutput.path.includes('${workspaceFolder}')
      ? config.infosetOutput.path.replace('${workspaceFolder}', rootPath)
      : config.infosetOutput.path

    let uri = vscode.Uri.file(infosetPath)

    // Only prompt to open infoset file if it has content
    if (fs.readFileSync(uri.fsPath).toString() !== '') {
      const action = await vscode.window.showInformationMessage(
        `Wrote infoset file to ${infosetPath}`,
        'Open',
        'Dismiss'
      )

      switch (action) {
        case 'Open':
          let infoset = await vscode.workspace.openTextDocument(uri)
          await vscode.window.showTextDocument(infoset, {
            preview: false,
            viewColumn: vscode.ViewColumn.One,
          })
          break
      }
    }
  }
}

export async function activate(ctx: vscode.ExtensionContext) {
  let sid: string | undefined
  let doc: vscode.TextDocument | undefined

  ctx.subscriptions.push(
    vscode.debug.onDidStartDebugSession((s) => {
      sid = s.id
      onDebugStartDisplay(['infoset-view', 'infoset-diff-view', 'data-editor'])
    })
  )
  ctx.subscriptions.push(
    vscode.debug.onDidTerminateDebugSession(async (s) => {
      if (sid !== undefined) {
        let filepath = tmpFile(sid)
        fs.rmSync(`${filepath}`, { force: true })
        fs.rmSync(`${filepath}.prev.xml`, { force: true })
      }
      sid = undefined
      await openInfosetFilePrompt()
    })
  )

  ctx.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      'daffodil:infoset',
      fileInfosetProvider
    )
  )

  ctx.subscriptions.push(
    vscode.commands.registerCommand('infoset.display', async () => {
      if (sid !== undefined) {
        let filepath = ensureFile(tmpFile(sid))
        doc = await vscode.workspace.openTextDocument(filepath)
        await vscode.window.showTextDocument(doc, {
          viewColumn: vscode.ViewColumn.Two,
          preserveFocus: true,
          preview: false,
        })
      }
    })
  )

  ctx.subscriptions.push(
    vscode.commands.registerCommand(
      'infoset.save',
      async (id: string, e: daf.InfosetEvent) => {
        if (sid !== undefined) {
          let dest = await vscode.window.showInputBox({
            placeHolder: 'Save infoset as:',
          })
          if (dest) {
            let rootPath = vscode.workspace.workspaceFolders
              ? vscode.workspace.workspaceFolders[0].uri.fsPath
              : vscode.Uri.parse('').fsPath

            dest = path.join(rootPath, dest)

            fs.copyFile(tmpFile(sid), dest, async () => {
              const choice = await vscode.window.showInformationMessage(
                `Wrote infoset to ${dest}`,
                'View',
                'Delete'
              )
              let uri = Uri.file(dest!)
              switch (choice) {
                case 'View':
                  let xml = await vscode.workspace.openTextDocument(uri)
                  await vscode.window.showTextDocument(xml, {
                    preview: false,
                    viewColumn: vscode.ViewColumn.Two,
                  })
                  break
                case 'Delete':
                  fs.unlinkSync(dest!)
                  break
              }
            })
          }
        }
      }
    )
  )

  ctx.subscriptions.push(
    vscode.commands.registerCommand('infoset.diff', async () => {
      if (sid !== undefined) {
        let filepath = ensureFile(tmpFile(sid))
        let prev = ensureFile(`${filepath}.prev.xml`)
        vscode.commands.executeCommand(
          'vscode.diff',
          Uri.file(prev),
          Uri.file(filepath),
          'Previous ↔ Current',
          { preview: false, viewColumn: vscode.ViewColumn.Two }
        )
      }
    })
  )
}

const fileInfosetProvider = new (class
  implements vscode.TextDocumentContentProvider
{
  provideTextDocumentContent(uri: vscode.Uri): string {
    return fs.readFileSync(uri.path).toString()
  }
})()
