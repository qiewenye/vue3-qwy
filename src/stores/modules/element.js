import { defineStore } from "pinia";
import { ref, reactive } from "vue";

export const useElmentAttrStore = defineStore("element_attrs", {
  state: () => ({
    angle: 0,
    opacity: 100,
    blur: 0,
    strokeWidth: 0,
    strokeDasharray: "none",
    line: { x1: 0, y1: 0, x2: 0, y2: 0 },
    rect: { x: 0, y: 0, width: 0, height: 0 },
    ellipse: { cx: 0, cy: 0, rx: 0, ry: 0 },
    path: { x: 0, y: 0 },
    text: {
      x: 0,
      y: 0,
      fontFamily: "'黑体'",
      fontSize: "24",
      fontStyle: "none",
    },
    pathPoint: { x: 0, y: 0, type: "4" },
    g: { x: 0, y: 0, id: "" },
  }),
});

