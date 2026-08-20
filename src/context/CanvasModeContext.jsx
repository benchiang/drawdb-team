import { createContext, useRef, useState } from "react";

// 画布交互模式：用于工具条手形工具切换
// panMode 开启时，画布左键拖动直接平移画布，不再走框选/拖动元素
export const CanvasModeContext = createContext(null);

export default function CanvasModeContextProvider({ children }) {
  const [panMode, setPanMode] = useState(false);
  // ref 同步给 Canvas 的 pointerdown 闭包读取，避免批处理时拿到旧值
  const panModeRef = useRef(false);
  const setPanModeSafe = (v) => {
    panModeRef.current = !!v;
    setPanMode(!!v);
  };
  return (
    <CanvasModeContext.Provider
      value={{ panMode, setPanMode: setPanModeSafe, panModeRef }}
    >
      {children}
    </CanvasModeContext.Provider>
  );
}
