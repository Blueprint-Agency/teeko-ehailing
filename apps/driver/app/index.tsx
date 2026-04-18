import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";

export default function Home() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Teeko Driver</Text>
        <Text style={styles.subtitle}>Driver app — v0.1 mockup</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 48, fontWeight: "700", color: "#DC2626" },
  subtitle: { fontSize: 16, color: "#9CA3AF", marginTop: 8 },
});
