import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";
import { routingConfig } from "./config";

export const routing = defineRouting(routingConfig);

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
