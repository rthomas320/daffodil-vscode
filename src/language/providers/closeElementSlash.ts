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
import { checkMissingCloseTag } from './closeUtils'
import {
  insertSnippet,
  checkBraceOpen,
  isInXPath,
  isNotTriggerChar,
  getNsPrefix,
  getItemPrefix,
  getItemsOnLineCount,
  cursorWithinBraces,
  cursorWithinQuotes,
  cursorAfterEquals,
} from './utils'

export function getCloseElementSlashProvider() {
  return vscode.languages.registerCompletionItemProvider(
    'dfdl',
    {
      async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        let backpos = new vscode.Position(position.line, position.character - 1)
        let nsPrefix = getNsPrefix(document, position)
        let triggerText = document.lineAt(position.line).text
        let tagPos = triggerText.lastIndexOf('<' + nsPrefix + ':')
        triggerText.lastIndexOf(',' + nsPrefix + ':')
        if (tagPos < 0) {
          tagPos = triggerText.lastIndexOf('<dfdl:')
          if (tagPos > 0) {
            nsPrefix = 'dfdl:'
          }
        }

        triggerText = document
          .lineAt(position)
          .text.substring(0, position.character)
        let nearestTagNotClosed = checkMissingCloseTag(
          document,
          position,
          nsPrefix
        )
        const itemsOnLine = getItemsOnLineCount(triggerText)
        const triggerChar = '/'
        if (
          checkBraceOpen(document, position) ||
          cursorWithinBraces(document, position) ||
          cursorWithinQuotes(document, position) ||
          cursorAfterEquals(document, position) ||
          isInXPath(document, position) ||
          isNotTriggerChar(document, position, triggerChar)
        ) {
          return undefined
        }

        if (!(nearestTagNotClosed == 'none')) {
          let range = new vscode.Range(backpos, position)

          await vscode.window.activeTextEditor?.edit((editBuilder) => {
            editBuilder.replace(range, '')
          })
        }

        if (triggerText.endsWith('/')) {
          checkItemsOnLine(
            document,
            position,
            itemsOnLine,
            nearestTagNotClosed,
            backpos,
            nsPrefix,
            triggerText
          )
        }

        //return undefined
      },
    },
    '/'
    // triggered whenever a '/' is typed
  )
}

export function getTDMLCloseElementSlashProvider() {
  return vscode.languages.registerCompletionItemProvider(
    'tdml',
    {
      async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        let backpos = position.with(position.line, position.character - 1)
        const nsPrefix = getNsPrefix(document, position)
        const triggerText = document
          .lineAt(position)
          .text.substring(0, position.character)
        let nearestTagNotClosed = checkMissingCloseTag(
          document,
          position,
          nsPrefix
        )
        const itemsOnLine = getItemsOnLineCount(triggerText)

        if (
          checkBraceOpen(document, position) ||
          cursorWithinBraces(document, position) ||
          cursorWithinQuotes(document, position) ||
          cursorAfterEquals(document, position) ||
          isInXPath(document, position)
        ) {
          return undefined
        }

        if (triggerText.endsWith('/')) {
          checkItemsOnLine(
            document,
            position,
            itemsOnLine,
            nearestTagNotClosed,
            backpos,
            nsPrefix,
            triggerText
          )
        }

        return undefined
      },
    },
    '/'
    // triggered whenever a '/' is typed
  )
}

function checkItemsOnLine(
  document: vscode.TextDocument,
  position: vscode.Position,
  itemsOnLine: number,
  nearestTagNotClosed: string,
  backpos: vscode.Position,
  nsPrefix: string,
  triggerText: string
) {
  nsPrefix = getItemPrefix(nearestTagNotClosed, nsPrefix)

  if (
    !(nearestTagNotClosed == 'none') &&
    (itemsOnLine == 1 || itemsOnLine == 0)
  ) {
    if (
      nearestTagNotClosed.includes('defineVariable') ||
      nearestTagNotClosed.includes('setVariable')
    ) {
      insertSnippet('/>\n', backpos)
    } else {
      insertSnippet('/>$0', backpos)
    }
  }

  if (itemsOnLine > 1) {
    if (
      triggerText.endsWith('/') &&
      triggerText.includes('<' + nsPrefix + nearestTagNotClosed)
    ) {
      let tagPos = triggerText.lastIndexOf('<' + nsPrefix + nearestTagNotClosed)
      let tagEndPos = triggerText.indexOf('>', tagPos)

      if (
        tagPos != -1 &&
        !triggerText.substring(tagEndPos - 1, 2).includes('/>') &&
        triggerText
          .substring(backpos.character - 1, backpos.character)
          .includes('>') &&
        !triggerText
          .substring(tagEndPos)
          .includes('</' + nsPrefix + nearestTagNotClosed)
      ) {
        insertSnippet('</' + nsPrefix + nearestTagNotClosed + '>$0', backpos)
      } else {
        insertSnippet('/>$0', backpos)
      }
    }
  }
}
