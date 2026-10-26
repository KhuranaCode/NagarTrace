import React,{useEffect,useState} from 'react';
export {Link,NavLink,Routes,Route} from 'react-router-dom';
type Child={children?:React.ReactNode};
export function FileCard({children}:Child){return <main className="app-shell">{children}</main>}
export function Header({title,fact,intro}:any){return <header className="app-header"><small>{fact}</small><h1>{title}</h1><p>{intro}</p></header>}
export function Group({children,label,heading}:Child&{label:string,heading?:boolean}){return <section className="app-group">{heading?<h2>{label}</h2>:<h3>{label}</h3>}{children}</section>}
export function Closing({children}:Child){return <footer className="app-closing">{children}</footer>}
export function Caption({children}:Child){return <p className="app-caption">{children}</p>}
export function Callout({children,title}:Child&{title:string}){return <aside className="app-callout"><strong>{title}</strong><div>{children}</div></aside>}
export function FileButton({children,variant='primary',...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:string}){return <button type="button" className={'app-button '+variant} {...props}>{children}</button>}
export function TextField({label,value,onChange}:any){return <label className="app-field">{label}<input value={value} onChange={e=>onChange(e.target.value)}/></label>}
export function ChoiceRow({label,value,onChange,options}:any){return <fieldset className="app-choices"><legend>{label}</legend>{options.map((o:any)=><button key={o.value} type="button" aria-pressed={o.value===value} onClick={()=>onChange(o.value)}>{o.label}</button>)}</fieldset>}
export function Facts({items}:any){return <dl className="file-facts">{items.map((i:any)=><div key={i.label}><dt>{i.label}</dt><dd>{i.value}</dd></div>)}</dl>}
export function useLocalState<T>(key:string,initial:T):[T,React.Dispatch<React.SetStateAction<T>>,{ready:boolean,message:string}]{
 const [value,setValue]=useState<T>(()=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):initial}catch{return initial}});
 const [message,setMessage]=useState('Stored on this device only. Not shared with another browser.');
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{setMessage('Storage unavailable. Changes last only while this page is open.')}},[value,key]);
 return [value,setValue,{ready:true,message}];
}
