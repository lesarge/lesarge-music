import React from 'react';
import AceEditor from 'react-ace';

// Import all popular ace modes and themes
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-typescript';
import 'ace-builds/src-noconflict/mode-c_cpp';
import 'ace-builds/src-noconflict/mode-rust';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/mode-css';
import 'ace-builds/src-noconflict/mode-json';

import 'ace-builds/src-noconflict/theme-monokai';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/theme-tomorrow_night';
import 'ace-builds/src-noconflict/theme-solarized_dark';
import 'ace-builds/src-noconflict/theme-dracula';
import 'ace-builds/src-noconflict/theme-nord_dark';

import 'ace-builds/src-noconflict/ext-language_tools';
import 'ace-builds/src-noconflict/ext-searchbox';

export type AceMode = 'python' | 'javascript' | 'typescript' | 'c_cpp' | 'rust' | 'html' | 'css' | 'json';
export type AceTheme = 'monokai' | 'github' | 'tomorrow_night' | 'solarized_dark' | 'dracula' | 'nord_dark';

interface AceCodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  mode?: AceMode;
  theme?: AceTheme;
  readOnly?: boolean;
  height?: string;
  fontSize?: number;
}

export const AceCodeEditor: React.FC<AceCodeEditorProps> = ({
  code,
  onChange,
  mode = 'python',
  theme = 'monokai',
  readOnly = false,
  height = '350px',
  fontSize = 13,
}) => {
  return (
    <div className="rounded-lg overflow-hidden border border-slate-800 shadow-inner">
      <AceEditor
        mode={mode}
        theme={theme}
        name="ace_code_editor"
        onChange={onChange}
        value={code}
        fontSize={fontSize}
        showPrintMargin={false}
        showGutter={true}
        highlightActiveLine={true}
        readOnly={readOnly}
        width="100%"
        height={height}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: true,
          showLineNumbers: true,
          tabSize: 4,
          useWorker: false,
        }}
      />
    </div>
  );
};
