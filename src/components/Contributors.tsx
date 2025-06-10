'use client'
import React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '../components/ui/dialog';
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { Badge } from "./ui/badge";
import packageJson from '../../package.json';

interface ContributorsProps {
  darkMode: boolean;
}

const contributors = [
  {
    name: "Aman Maheshwari",
    github: "Amanmahe",
    avatar: "https://avatars.githubusercontent.com/Amanmahe",
  },

  {
    name: "Deepak Khatri",
    github: "lorforlinux",
    avatar: "https://avatars.githubusercontent.com/u/20015794?v=4",
  },
  {
    name: "Krishnanshu Mittal",
    github: "CIumsy",
    avatar: "https://avatars.githubusercontent.com/u/76506050?v=4",
  },
  {
    name: "Ritika Mishra",
    github: "Ritika8081",
    avatar: "https://avatars.githubusercontent.com/u/103934960?v=4",
  },

];

export default function Contributors({ darkMode }: ContributorsProps) {
  const iconBtnClasses = `p-1 rounded-full transition-all duration-300 ${darkMode
    ? 'text-zinc-200'
    : 'text-stone-700'
    } shadow-sm`;


  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          {/* Single button used for both Tooltip and DialogTrigger */}
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button type="button" className={iconBtnClasses}>
                <CircleAlert className="h-5 w-5 cursor-pointer" />
                <span className="sr-only">View Contributors</span>
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Contributors</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-[425px] md:max-w-[570px] lg:max-w-[650px]">
        <DialogTitle className="text-2xl font-semibold mb-4">
          Contributors
        </DialogTitle>
        <Card className="border-none">
          <CardHeader className="p-0 mb-2">
            <CardTitle className="font-bold items-center gap-2 flex mb-1">
              <Badge className="text-xs bg-muted-foreground">v{packageJson.version}</Badge>
            </CardTitle>
            <div className="flex flex-col justify-center items-center">
              <p className="text-2xl font-semibold">Contributors</p>
              <p className={`text-xs ${darkMode ? 'text-zinc-400' : 'text-muted-foreground'}`}>Listed alphabetically</p>
            </div>
          </CardHeader>
          <Separator className="mb-4" />
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {contributors.map((contributor) => (
                <Link
                  key={contributor.github}
                  href={`https://github.com/${contributor.github}`}
                  target="_blank"
                  className="group"
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex flex-col items-center space-y-2 transition-transform duration-200 ease-in-out transform group-hover:scale-105">
                          <Avatar className="h-16 w-16 border-2 border-transparent group-hover:border-primary">
                            <AvatarImage
                              src={contributor.avatar}
                              alt={contributor.name}
                            />
                            <AvatarFallback>
                              {contributor.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-xs font-medium text-center group-hover:text-primary transition-colors duration-200">
                            {contributor.name}
                          </p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{contributor.name}</p>
                        <p className="text-xs text-muted-foreground">
                          @{contributor.github}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}