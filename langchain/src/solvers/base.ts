/* eslint-disable no-param-reassign */
type JsonyObj = {[key: string]: JsonyObj | JsonyObj[] | string;}

interface DefaultsStore {
  [lookupPath: string]: {
    [defaultKey: string]: string;
  };
}

export function deNoise(noisyJson: JsonyObj, keepPaths:string[]): [signalJson: JsonyObj, defaultsStore: DefaultsStore] {
  const defaultsStore: DefaultsStore = {};

  function removeNoisyDefaults(obj: JsonyObj, path: string[] = []): JsonyObj {
    const res = Object.entries(obj).reduce((newObj, [key, value]) => {
      const lookupPath = path.concat(key).join('.'); //=
      const defaults = defaultsStore[lookupPath] || {};
      const defaultValue = defaults[key];
  
      if (Array.isArray(value) && (typeof value !== 'string')) {
        newObj[key] = value.map((item, index) => removeNoisyDefaults(item, [...path, key, index.toString()]));
      } else if (typeof value === 'object' && value !== null) {
        newObj[key] = removeNoisyDefaults(value, [...path, key]);
      } else if (defaultValue === value) {
        delete defaults[key]; 
  
        if (Object.keys(defaults).length === 0) {
          delete defaultsStore[lookupPath];
        }
      } else if (keepPaths.includes(lookupPath)) {
        newObj[key] = value; 
      } else {
        const store = defaultsStore[lookupPath] || {};
        defaultsStore[lookupPath] = { ...store, [key]: value };
        
      }           
  
      return newObj; //=
    }, {} as JsonyObj);
    return res //= 
  }

  const signalJson = removeNoisyDefaults(noisyJson);

  return [signalJson, defaultsStore];
}

export function reNoise(signalJson: JsonyObj, defaultsStore: DefaultsStore): JsonyObj {
  function restoreNoisyDefaults(obj: JsonyObj, path: string[] = []): JsonyObj {
    return Object.entries(obj).reduce((newObj, [key, value]) => {
      const lookupPath = path.concat(key).join('.'); //=
      const defaults = defaultsStore[lookupPath] || {};
      const defaultValue = defaults[key];

      if (Array.isArray(value)) {
        newObj[key] = value.map((item, index) => restoreNoisyDefaults(item, [...path, key, index.toString()]));
      } else if (defaultValue !== undefined) {
        newObj[key] = defaultValue;
      } else if (typeof value === 'object' && value !== null) {
        newObj[key] = restoreNoisyDefaults(value, [...path, key]);
      } else {
        newObj[key] = value;
      }

      return newObj;
    }, {} as JsonyObj);
  }

  const noisyJson = restoreNoisyDefaults(signalJson);

  return noisyJson;
}

type JsonValue = string | number | boolean | null;
interface JsonObj {[key: string]: JsonValue | JsonArray | JsonObj;}
type JsonArray = Array<JsonObj>

function isObject(item: JsonObj): item is JsonObj {
  return (item && typeof item === 'object' && !Array.isArray(item));
}


function mergeDeep(target: JsonObj, ...sources: JsonObj[]): JsonObj {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && source && isObject(source)) {    
    Object.keys(source).forEach( key => {
      if (isObject(source[key] as JsonObj)) {
        if (!target[key]) { 
          Object.assign(target, { [key]: {} });
        } else {          
          target[key] = { ...(target[key] as JsonObj)}
        }
        mergeDeep(target[key] as JsonObj, source[key] as JsonObj);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    })
  }

  return mergeDeep(target, ...sources);
}

function mergeDeep2(target: JsonObj, ...sources: JsonObj[]): JsonObj {
  return _mergeDeep(false, target, ...sources)
}
function mergeDeepNoStomp(target: JsonObj, ...sources: JsonObj[]): JsonObj {
  return _mergeDeep(true, target, ...sources)
}
function _mergeDeep(blockStomp:boolean, target: JsonObj, ...sources: JsonObj[]): JsonObj {
  if (!sources.length) return target
  const source = sources.shift()
  if (isObject(target) && source && isObject(source)) {    
    Object.keys(source).forEach(key => {
      if (isObject(source[key] as JsonObj)) {
        if (!(key in target)) Object.assign(target, { [key]: {} }) // add a place to merge into
        _mergeDeep(blockStomp, target[key] as JsonObj, source[key] as JsonObj) // now merge into that place
      } else if (!blockStomp || !(key in target)) { // check if target already has the key
        Object.assign(target, { [key]: source[key] }) // add the key-value pair to target
      }
    })
  }
  return _mergeDeep(blockStomp, target, ...sources)
}



const a = {a:888, b:{u:222,v:7}}
const b = {a:8, c:{p:1,q:1}}
const c = {b:{u:2}}
const jj = (obj:JsonObj) => JSON.parse(JSON.stringify(obj))
console.log(mergeDeep2(jj(a), jj(b), jj(c))       )
console.log(mergeDeepNoStomp(a, b, c)          )




type Patch = {
  match: JsonObj,
  patch: JsonObj
}

function patchObjsForPathMatches(target: JsonObj, ifMatchPatches: Patch[]): JsonObj {
  for (const { match, patch } of ifMatchPatches) {
    const matchedObj = findObjMatchInsideObj(target, match);
    if (matchedObj) {
      target = mergeDeep(matchedObj, patch, JSON.parse(JSON.stringify(target)));
      // target = mergeDeep(matchedObj, patch, target);
    }
  }
  return target;
}

function findObjMatchInsideObj(obj: JsonObj, match: JsonObj): JsonObj | null {
  const matchKeys = Object.keys(match);
  const matchedObj = Object.entries(obj).find(([key, value]) => {
    if (matchKeys.includes(key)) {
      if (typeof value === 'object' && value !== null) {
        return findObjMatchInsideObj(value as JsonObj, match[key] as JsonObj);
      }
      return value === match[key];
    }
    return false;
  });
  return matchedObj ? obj : null;
}
const ifMatchPatches = [{match: { llm: {model_name: "text-davinci-003"}}, patch: {a:777, llm:{_type:"openai", z:555}}}]
patchObjsForPathMatches(        { llm: {model_name: "text-davinci-003"}, a:7}, ifMatchPatches) //=

// test deNoise and reNoise
const noisyJson = JSON.parse(` 
{
  "memory": null,
  "verbose": true,
  "llm": {
      "model_name": "text-davinci-003",
      "temperature": 0.0,
      "max_tokens": 256,
      "top_p": 1,
      "frequency_penalty": 0,
      "presence_penalty": 0,
      "n": 1,
      "best_of": 1,
      "request_timeout": null,
      "logit_bias": {},
      "_type": "openai"
  },
  "input_key": "question",
  "output_key": "answer",
  "prompt": {
      "input_variables": [
          "question"
      ],
      "output_parser": null,
      "template": "If someone asks you to perform a task, your job is to come up with a series of bash commands that will perform the task. There is no need to put \\"#!/bin/bash\\" in your answer. Make sure to reason step by step, using this format:\\n\\nQuestion: \\"copy the files in the directory named 'target' into a new directory at the same level as target called 'myNewDirectory'\\"\\n\\nI need to take the following actions:\\n- List all files in the directory\\n- Create a new directory\\n- Copy the files from the first directory into the second directory\\n\`\`\`bash\\nls\\nmkdir myNewDirectory\\ncp -r target/* myNewDirectory\\n\`\`\`\\n\\nThat is the format. Begin!\\n\\nQuestion: {question}",
      "template_format": "f-string",
      "_type": "prompt"
  },
  "_type": "llm_bash_chain"
}`)
function deNoiseDefaultsByPath(obj: JsonyObj, pathsToKeep: string[]): [signalJson: JsonyObj, defaultsStore: DefaultsStore] {
  const defaultsStore: DefaultsStore = {};

  function removeNoisyDefaults(obj: JsonyObj, path: string[] = []): JsonyObj {
    const newObj: JsonyObj = {};

    for (const [key, value] of Object.entries(obj)) {
      const newPath = [...path, key];
      const lookupPath = newPath.join('.');
      const shouldKeepPath = pathsToKeep.some((pathToKeep) => lookupPath.startsWith(pathToKeep));

      if (shouldKeepPath) {
        newObj[key] = value;
        continue;
      }

      const store = defaultsStore[lookupPath] || {};
      if (Array.isArray(value)) {
        newObj[key] = value.map((item, index) => removeNoisyDefaults(item, [...newPath, index.toString()]));
      } else if (typeof value === 'object' && value !== null) {
        newObj[key] = removeNoisyDefaults(value, newPath);
      } else if (store[key] === value) {
        delete store[key];

        if (Object.keys(store).length === 0) {
          delete defaultsStore[lookupPath];
        }
      } else {
        store[key] = value;
      }
    }

    return newObj;
  }

  const signalJson = removeNoisyDefaults(obj);

  return [signalJson, defaultsStore];
}
// const [signalJson, defaultsStore] = deNoise(noisyJson, ['llm.model_name', 'llm.temperature', 'llm.max_tokens', 'llm.top_p', 'llm.frequency_penalty', 'llm.presence_penalty', 'llm.n', 'llm.best_of', 'llm.request_timeout', 'llm.logit_bias', 'input_key', 'output_key', 'prompt.input_variables', 'prompt.output_parser', 'prompt.template', 'prompt.template_format']);
// const [signalJson, defaultsStore] = deNoise(noisyJson, [
//   'llm.model_name', 
//   'llm._type', 
//   'output_key', 
//   'prompt.template', 
//   ]);
const [signalJson, defaultsStore] = deNoiseDefaultsByPath(noisyJson, [
  'llm.model_name', 
  'llm._type', 
  'output_key', 
  'prompt.template', 
  ]);
console.log(signalJson); //= signalJson
console.log(defaultsStore); //= defaultsStore
const noisyJson2 = reNoise(signalJson, defaultsStore); //= noisyJson 
console.log(noisyJson2); 