import { useContext } from "react";
import { CanvasModeContext } from "../context/CanvasModeContext";

export default function useCanvasMode() {
  return useContext(CanvasModeContext);
}
