import React from "react";
import { Input, Select, Space } from "antd";
import type { TranslationStatus } from "@/components/common/StatusBadge";

const { Option } = Select;
const { Search } = Input;

interface FilterBarProps {
  searchValue: string;
  statusValue: TranslationStatus | null;
  onSearch: (value: string) => void;
  onStatusChange: (value: TranslationStatus | null) => void;
  searchPlaceholder?: string;
}

const statusOptions: { value: TranslationStatus; label: string }[] = [
  { value: "PENDING", label: "待翻译" },
  { value: "TRANSLATING", label: "翻译中" },
  { value: "REVIEWING", label: "审核中" },
  { value: "APPROVED", label: "已通过" },
  { value: "PUBLISHED", label: "已发布" },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  searchValue,
  statusValue,
  onSearch,
  onStatusChange,
  searchPlaceholder = "搜索...",
}) => {
  return (
    <Space wrap style={{ marginBottom: 16 }}>
      <Search
        placeholder={searchPlaceholder}
        style={{ width: 300 }}
        value={searchValue}
        onChange={(e) => onSearch(e.target.value)}
        onSearch={onSearch}
        allowClear
      />
      <Select
        placeholder="按状态筛选"
        style={{ width: 150 }}
        value={statusValue}
        onChange={(value) => onStatusChange(value || null)}
        allowClear
      >
        {statusOptions.map((opt) => (
          <Option key={opt.value} value={opt.value}>
            {opt.label}
          </Option>
        ))}
      </Select>
    </Space>
  );
};

export default FilterBar;
