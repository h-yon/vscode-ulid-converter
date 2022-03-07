import * as ulid from 'ulid';
import * as vscode from 'vscode';

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford's Base32
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;

function decodeRandom(id: string): bigint {
  var random = id
    .substring(TIME_LEN)
    .split('')
    .reverse()
    .reduce((carry, char, index) => {
      const encodingIndex = ENCODING.indexOf(char);
      return (carry += BigInt(encodingIndex * Math.pow(ENCODING_LEN, index)));
    }, BigInt(0));
  return random;
}

function decode(id: string, radix: number): string {
  let time = ulid.decodeTime(id).toString(radix);
  if (time === '0') {
    time = '';
  }
  const random = decodeRandom(id).toString(radix);
  return time + random;
}

function encodePart(part: number, len: number): string {
  let mod;
  let str = '';
  for (; len > 0; len--) {
    mod = part % ENCODING_LEN;
    str = ENCODING.charAt(mod) + str;
    part = (part - mod) / ENCODING_LEN;
  }
  return str;
}

function encode(id: string): string {
  let str = '';
  let tail;
  while (id.length > 0) {
    tail = id.slice(-5);
    str = encodePart(parseInt('0x' + tail), Math.min(4, id.length)) + str;
    id = id.slice(0, -5);
  }
  return str;
}

export function activate(context: vscode.ExtensionContext) {
  const commands = [
    vscode.commands.registerTextEditorCommand(
      'ulid-hex-converter.encode',
      (editor, edit) => {
        try {
          let id = editor.document.getText(editor.selection).toLowerCase();
          if (id.substring(0, 2) === '0x') {
            id = id.substring(2);
          }
          if (id.length > 32) {
            throw new Error('too long string');
          }
          id = id.padStart(32, '0');
          if (id.search(/^[0-9a-f]+$/) === -1) {
            throw new Error('malformed hex');
          }
          edit.replace(editor.selection, encode(id));
        } catch (e) {
          if (e instanceof Error) {
            vscode.window.showErrorMessage(e.message);
          }
        }
      }
    ),
    vscode.languages.registerHoverProvider([{ language: 'plaintext' }], {
      provideHover(document, position, token) {
        const wordRange = document.getWordRangeAtPosition(
          position,
          /[0-7][0123456789ABCDEFGHJKMNPQRSTVWXYZ]{25}/
        );
        if (wordRange === undefined) {
          return undefined;
        }

        const currentWord = document.getText(wordRange);
        return new vscode.Hover(
          `ULID: \`${currentWord}\`\n\n` +
            `time: ${new Date(
              ulid.decodeTime(currentWord)
            ).toISOString()}\n\n` +
            `hex: \`${decode(currentWord, 16)}\``
        );
      },
    }),
  ];

  context.subscriptions.push(...commands);
}

export function deactivate() {}
