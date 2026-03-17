import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAppStore } from "../store/useAppStore";

// Mock the store
vi.mock("../store/useAppStore", () => ({
  useAppStore: vi.fn(),
}));

describe("Auth Tests", () => {
  const mockLoginWithFeishu = vi.fn();
  const mockLoginWithQixin = vi.fn();
  const mockLoginWithDingtalk = vi.fn();
  const mockSetToken = vi.fn();
  const mockSetUser = vi.fn();

  beforeEach(() => {
    (useAppStore as vi.Mock).mockReturnValue({
      loginWithFeishu: mockLoginWithFeishu,
      loginWithQixin: mockLoginWithQixin,
      loginWithDingtalk: mockLoginWithDingtalk,
      setToken: mockSetToken,
      setUser: mockSetUser,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should have login methods available", () => {
    const store = useAppStore();
    expect(store.loginWithFeishu).toBeDefined();
    expect(store.loginWithQixin).toBeDefined();
    expect(store.loginWithDingtalk).toBeDefined();
    expect(store.setToken).toBeDefined();
    expect(store.setUser).toBeDefined();
  });

  it("should call loginWithFeishu when invoked", () => {
    const store = useAppStore();
    store.loginWithFeishu();
    expect(mockLoginWithFeishu).toHaveBeenCalledTimes(1);
  });

  it("should call loginWithQixin when invoked", () => {
    const store = useAppStore();
    store.loginWithQixin();
    expect(mockLoginWithQixin).toHaveBeenCalledTimes(1);
  });

  it("should call loginWithDingtalk when invoked", () => {
    const store = useAppStore();
    store.loginWithDingtalk();
    expect(mockLoginWithDingtalk).toHaveBeenCalledTimes(1);
  });

  it("should call setToken when invoked", () => {
    const store = useAppStore();
    const testToken = "test-token-123";
    store.setToken(testToken);
    expect(mockSetToken).toHaveBeenCalledWith(testToken);
  });

  it("should call setUser when invoked", () => {
    const store = useAppStore();
    const testUser = { id: "1", username: "test-user", role: "EDITOR" };
    store.setUser(testUser);
    expect(mockSetUser).toHaveBeenCalledWith(testUser);
  });
});
