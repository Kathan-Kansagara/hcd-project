import { useEffect, useCallback } from "react"
import { type LucideIcon } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMainZenon({
  groups,
}: {
  groups: {
    label: string
    items: {
      title: string
      url: string
      icon?: LucideIcon
    }[]
  }[]
}) {
  const location = useLocation()

  // On mount (page load / refresh), scroll the active sidebar item into
  // view so the user can always see which page is selected.
  useEffect(() => {
    const timer = setTimeout(() => {
      const activeEl = document.querySelector(
        '[data-sidebar="menu-button"][data-active="true"]'
      )
      activeEl?.scrollIntoView({ block: "nearest", behavior: "instant" })
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // When a sidebar link is clicked, prevent the browser's default
  // focus-scroll from jumping the sidebar container.
  const handleLinkMouseDown = useCallback((e: React.MouseEvent) => {
    const scrollContainer = (e.currentTarget as HTMLElement).closest(
      '[data-sidebar="content"]'
    )
    if (scrollContainer) {
      const scrollTop = scrollContainer.scrollTop
      const lock = () => { scrollContainer.scrollTop = scrollTop }
      scrollContainer.addEventListener("scroll", lock)
      setTimeout(() => scrollContainer.removeEventListener("scroll", lock), 200)
    }
  }, [])

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const isActive = location.pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive}
                    >
                      <Link to={item.url} onMouseDown={handleLinkMouseDown}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
