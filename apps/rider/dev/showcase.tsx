import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet, Text, View } from "react-native";

export default function Home() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Teeko</Text>
        <Text style={styles.subtitle}>Rider app — v0.1 mockup</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 48, fontWeight: "700", color: "#DC2626" },
  subtitle: { fontSize: 16, color: "#6B7280", marginTop: 8 },
});
