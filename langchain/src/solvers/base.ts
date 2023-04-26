/* eslint-disable no-param-reassign */
// import { isObject } from "./isObject";
// import { JsonObj, JsonValue, JsonArray } from "./JsonObj";
// import { mergeDeep, mergeDeepNoStomp } from "./mergeDeep";
export function BaseSolver() {}
export function SolverInputs() {}

type JsonValue = string | number | boolean | null;
interface JsonObj {
  [key: string]: JsonValue | JsonArray | JsonObj;
}
type JsonArray = Array<JsonObj | JsonValue>;
function isObject(item: JsonObj | JsonArray | JsonValue): boolean {
  if (item === null || item === undefined)
    return false;
  return (typeof item === 'object' && !Array.isArray(item));
}

function _mergeDeep(canStomp:boolean, target: JsonObj, ...sources: JsonObj[]): JsonObj {
  if (!sources.length) return target
  const source = sources.shift()
  if (isObject(target) && source && isObject(source)) {    
    Object.keys(source).forEach(key => {
      if (isObject(source[key] as JsonObj)) {
        if (!(key in target)) Object.assign(target, { [key]: {} }) // add a place to merge into
        _mergeDeep(canStomp, target[key] as JsonObj, source[key] as JsonObj) // now merge into that place
      } else if (canStomp || !(key in target)) { // check if target already has the key
        Object.assign(target, { [key]: source[key] }) // add the key-value pair to target
      }
    })
  }
  return _mergeDeep(canStomp, target, ...sources)
}

function mergeDeep(target: JsonObj, ...sources: JsonObj[]): JsonObj {
  return _mergeDeep(true, target, ...sources)
}

function mergeDeepNoStomp(target: JsonObj, ...sources: JsonObj[]): JsonObj {
  return _mergeDeep(false, target, ...sources)
}

const a = {a:888, b:{u:222,v:7}}
const b = {a:8, c:{p:1,q:1}}
const c = {b:{u:2}}
const jj = (obj:JsonObj) => JSON.parse(JSON.stringify(obj))
console.log(mergeDeep(jj(a), jj(b), jj(c))       ) 
console.log(mergeDeepNoStomp(a, b, c)          )   

type Patch = {match: JsonObj, patch: JsonObj}

// type FullPatchFunc = (obj:JsonObj, key:string, val:JsonValue, match:JsonObj, patch:JsonObj, funcParams: JsonObj) => JsonObj
type PatchFunc     = (val:JsonValue, funcParams?:JsonObj) => (JsonValue | JsonArray)

function handlebars_to_array(val: JsonValue) : (JsonValue | JsonArray) {
  console.log(typeof val,val)
  if (typeof val === 'string') {
    const matches = val.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)
    return [...matches].map(m => m[1]) //=
  }
  return `##${val}`
}
function yay_it(val: JsonValue, funcParams: JsonObj) : (JsonValue | JsonArray) {
  return `YAY! ${JSON.stringify(funcParams)}  val was: ${JSON.stringify(val)}`
}
const patchFuncs = {
  handlebars_to_array,
  yay_it
} as {[key:string]: PatchFunc|null}
// TODO: add a transform function to the patchObjMatches function

function parseFuncAndJsonParams( str:string ) : [PatchFunc|null, JsonObj] {
  const funcName   = str.match(/^[a-zA-Z0-9_]+/)?.[0]
  const jsonParams = str.match(/\((.*)\)/)?.[1] || '{}'
  const func       = (funcName && patchFuncs[funcName]) || null //=
  return [func, JSON.parse(jsonParams)]
}
// parseFuncAndJsonParams('handlebars_to_array({"a":1,"b":{"c":2}})') //=
// patchFuncs.handlebars_to_array?.('hello {{world}}. Aloha to {{Hawaii}}') //=

function applyPatchFuncs(patch: JsonObj, matchVal: JsonValue): JsonObj {
  const mtchs = [] as [unknown, unknown, unknown, unknown, unknown, ][]
  function digForFuncs(obj: JsonObj, parentObj?: JsonObj, parentKey?: string) {
    Object.entries(obj).forEach(([key, val]) => {
      if (key==='__patchFunc') {
        const [func, jsonParams] = parseFuncAndJsonParams(val as string)
        if (func && parentObj && parentKey) { 
          parentObj[parentKey] = func(matchVal, jsonParams)
          mtchs.push([func, parentObj[parentKey], parentObj, parentKey, matchVal])
        }
      }
      else if (isObject(val)) digForFuncs(val as JsonObj, obj, key)
    })
  }
  digForFuncs(patch) 
  if (mtchs.length) console.log(mtchs)
  return patch
}

function patchObjMatches(obj: JsonObj, matchesToPatch: Patch[]): JsonObj {
  for (const { match, patch } of matchesToPatch) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [matchObj,_matchKey,matchVal] = findObjMatch(obj, match)
    if (matchObj) {
      const patch2 = applyPatchFuncs(patch, matchVal) //= matchVal
      obj = mergeDeepNoStomp(matchObj, patch2, JSON.parse(JSON.stringify(obj)));
    }
  }
  return obj;
}

function findObjMatch(obj: JsonObj, match: JsonObj): [JsonObj | null, string | null, JsonValue] {
  const matchKeys = Object.keys(match);
  if (matchKeys.length === 0) return [obj, null, null]; // lets you match an empty object to any object
  let matchKey = null;
  let matchVal = null;
  const matchObj = Object.entries(obj).find(([key, value]) => {
    if (matchKeys.includes(key)) {
      const valToMatch = match[key];
      if (typeof value === "object" && value !== null) {
        const [objMatch, objMatchKey, objMatchVal] = findObjMatch(value as JsonObj, valToMatch as JsonObj);
        if (objMatch) {
          matchKey = objMatchKey ? `${key}.${objMatchKey}` : key;
          matchVal = objMatchVal;
          return true;
        }
      } else if (valToMatch === "*" || value === valToMatch) {
        matchKey = key;
        matchVal = value;
        return true;
      }
    }
    return false;
  });
  return matchObj ? [obj, matchKey, matchVal] : [null, null, null]; //=
}


const matchesToPatch = [
  { match: {}, 
    patch: {memory: null, verbose: false, output_key: 'answer'}
  },
  { match: {llm:{model_name: "text-davinci-003"}}, 
    patch: {llm:{_type: 'openai'}}
  },
  { match: {llm:{_type: 'openai'} }, 
    patch: {llm:{
      temperature: 0.0, // max_tokens: 256, top_p: 1, frequency_penalty: 0, 
      // presence_penalty: 0, n: 1, best_of: 1, request_timeout: null, logit_bias: {},
    }},
  },
  { match: {prompt:{template:'*'} }, 
    patch: {prompt:{
      output_parser: null,
      template_format: 'f-string',
      _type: 'prompt',
      input_variables: { __patchFunc:'handlebars_to_array()' },
      tester: { __patchFunc:'yay_it({"foo":"boo"})' },
    }},
  },
  { match: {prompt:{template:'*'} }, 
    patch: {input_key: { __patchFunc:'handlebars_to_array()' }},
  },
] as Patch[]
patchObjMatches(
  { llm: {model_name: "text-davinci-003"}, prompt:{'template':'YAY!Answer questions as table rows, Q1:{{q1}}, Q2:{{q2}}, Q3:{{q3}}' }},
  matchesToPatch
) //= 


// const noisyJson = JSON.parse(` 
// {
//   "memory": null,
//   "verbose": true,
//   "llm": {
//       "model_name": "text-davinci-003",
//       "temperature": 0.0,
//       "max_tokens": 256,
//       "top_p": 1,
//       "frequency_penalty": 0,
//       "presence_penalty": 0,
//       "n": 1,
//       "best_of": 1,
//       "request_timeout": null,
//       "logit_bias": {},
//       "_type": "openai"
//   },
//   "input_key": "question",
//   "output_key": "answer",
//   "prompt": {
//       "input_variables": [
//           "question"
//       ],
//       "output_parser": null,
//       "template": "If someone asks you to perform a task, your job is to come up with a series of bash commands that will perform the task. There is no need to put \\"#!/bin/bash\\" in your answer. Make sure to reason step by step, using this format:\\n\\nQuestion: \\"copy the files in the directory named 'target' into a new directory at the same level as target called 'myNewDirectory'\\"\\n\\nI need to take the following actions:\\n- List all files in the directory\\n- Create a new directory\\n- Copy the files from the first directory into the second directory\\n\`\`\`bash\\nls\\nmkdir myNewDirectory\\ncp -r target/* myNewDirectory\\n\`\`\`\\n\\nThat is the format. Begin!\\n\\nQuestion: {question}",
//       "template_format": "f-string",
//       "_type": "prompt"
//   },
//   "_type": "llm_bash_chain"
// }`)
