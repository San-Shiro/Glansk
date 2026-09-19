import type { JsonValue, WidgetGeometry, WidgetInstance } from "../domain/types";
export interface ComponentDefinition { readonly packageId:string; readonly widgetId:string; readonly title:string; readonly category:"display"|"data"|"control"; readonly defaultGeometry:Omit<WidgetGeometry,"x"|"y"|"zIndex">; readonly defaultConfig:Record<string,JsonValue> }
export const componentCatalog:readonly ComponentDefinition[]=[
 {packageId:"glansk.core",widgetId:"text",title:"Text",category:"display",defaultGeometry:{width:240,height:80},defaultConfig:{text:"Text"}},
 {packageId:"glansk.core",widgetId:"value",title:"Value",category:"data",defaultGeometry:{width:220,height:120},defaultConfig:{label:"Metric",value:"--"}},
 {packageId:"glansk.core",widgetId:"button",title:"Button",category:"control",defaultGeometry:{width:160,height:64},defaultConfig:{label:"Action"}},
 {packageId:"glansk.demo",widgetId:"aurora-metric",title:"Aurora Metric",category:"data",defaultGeometry:{width:360,height:230},defaultConfig:{eyebrow:"LIVE SIGNAL",label:"Performance",value:"84.2",unit:"%",trend:"↗ 12.4%",detail:"Healthy trajectory",values:[24,38,31,52,49,70,64,82]}},
];
export function instantiateComponent(definition:ComponentDefinition,id:string,x:number,y:number,zIndex:number):WidgetInstance{return{id,packageId:definition.packageId,widgetId:definition.widgetId,geometry:{x,y,zIndex,...definition.defaultGeometry},config:structuredClone(definition.defaultConfig)}}
