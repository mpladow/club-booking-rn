// File: src/app/(tabs)/admin/tables/[tableId].tsx
import { useLocalSearchParams } from "expo-router";
import { type ReactElement } from "react";
import { TableForm } from "@/components/administration/TableForm";
const EditTableScreen = (): ReactElement => {
  const { tableId } = useLocalSearchParams<{ tableId: string }>();
  return <TableForm key={tableId} tableId={tableId ?? ""} />;
};
export default EditTableScreen;
