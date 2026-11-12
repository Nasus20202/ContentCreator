/** Static images imported from video/ are bundled by Remotion's webpack and resolve to a URL. */
declare module '*.png' {
  const src: string;
  export default src;
}
