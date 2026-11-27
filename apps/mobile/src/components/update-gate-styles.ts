import { StyleSheet } from "react-native";

export const PRIMARY = "#3b82f6";
export const OK = "#16a34a";
const TRACK = "#e5e9f0";

export const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  pill: {
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#dbeafe",
  },
  pillText: { color: PRIMARY, fontSize: 12, fontWeight: "700" },
  barTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    backgroundColor: TRACK,
    overflow: "hidden",
  },
  meta: {
    width: "100%",
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  whatsnew: {
    width: "100%",
    marginTop: 22,
    borderWidth: 1,
    borderRadius: 16,
    padding: 15,
  },
  noteRow: { flexDirection: "row", gap: 8, marginBottom: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PRIMARY, marginTop: 6 },
});
